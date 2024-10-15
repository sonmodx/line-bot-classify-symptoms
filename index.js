const { default: axios } = require("axios");
const express = require("express");
const { google } = require("googleapis");
const { formatDate } = require("./utils");
const app = express();

app.use(express.json());
require("dotenv").config();

const PORT = "8080";
const LINE_API = "https://api.line.me/v2/bot";
const serviceAccountKeyFile = "/workspace/service-account-key";
const sheetId = "18mEx7Ut_x59Wh3uByYPvS1rSfR9HIqfrsjsLh1IBwY8";
const tabName = "Users";
const range = "A:C";

let usersData = [];

const sequenceQuestion = [
  {
    question: [
      {
        type: "text",
        text: "ท่านมีการนัดหมายเพื่อเข้ารับการรักษาหรือไม่ (มี = ใช่ ไม่มี = ไม่)",
      },
    ],
    score: 0,
  },
  {
    question: [
      {
        type: "text",
        text: "ท่านมีนัดหมายเข้ารับการรักษาวันที่เท่าไหร่ (วว/ดด/ปป)",
      },
    ],
    score: 0,
  },
  {
    question: [
      {
        type: "text",
        text: "ท่านมีนัดหมายกับแพทย์ท่านใด (กรุณาตอบเป็นตัวเลข)\n1.พญ.รัชนี เชี่ยวชาญธนกิจ\n2.พญ. พิมพ์อนงค์ ภู่เหลือ\n3.พญ.วิภาวี ฮั่นตระกูล\n4.พญ.ธิดารัตน์ ลักษณานันท\n5.พญ. วิภาดา ส่งวัฒนา ",
      },
    ],
    score: 0,
  },
  {
    question: [
      {
        type: "text",
        text: "การคัดกรองอาการของผู้ป่วยทาง Online และการพยาบาล",
      },
      {
        type: "text",
        text: "ตอบคำถามต่อไปนี้เพียงใช่ หรือไม่",
      },
      {
        type: "text",
        text: "1. เจ็บแน่นหน้าอก ร่วมกับมีร้าวไปบริเวณไหล่ กรามหรือหลัง\n2. หายใจเหนื่อยหอบนอนราบไม่ได้\n3. ซึมลงหรือสับสน\nท่านมีอาการเหล่านี้หรือไม่",
      },
    ],
    score: 15,
  },
  {
    question: [
      {
        type: "text",
        text: "1. ปัสสาวะออกน้อยหรือบวมทั่วตัว (กรณีที่ยังไม่ได้ล้างไต)",
      },
    ],

    score: 5,
  },
  {
    question: [
      {
        type: "text",
        text: "2. คลื่นไส้ อาเจียน",
      },
    ],
    score: 2,
  },
  {
    question: [
      {
        type: "text",
        text: "3. กรณีที่สามารถวัดความดันโลหิตได้ สูงกว่า 200 ตัวบน ตัวล่างสูงกว่า 110 หรือน้อยกว่า 90 ตัวบน",
      },
    ],
    score: 5,
  },
  {
    question: [
      {
        type: "text",
        text: "4. เบื่ออาหาร อ่อนเพลีย",
      },
    ],
    score: 1,
  },
  {
    question: [
      {
        type: "text",
        text: "5. เป็นตะคริว",
      },
    ],

    score: 1,
  },
  {
    question: [
      {
        type: "text",
        text: "6. บวมที่เท้า",
      },
    ],

    score: 1,
  },
];

const sendMessage = async (userId, message, token) => {
  try {
    const headers = {
      ContentType: "application/json",
      Authorization: `Bearer ${token}`,
    };
    const body = {
      to: userId,
      messages: message,
    };

    const res = await axios.post(`${LINE_API}/message/push`, body, {
      headers,
    });

    return res;
  } catch (err) {
    console.error("Error sending message:", err);

    throw new Error(err);
  }
};

async function getUserProfile(userId, token) {
  try {
    const headers = {
      ContentType: "application/json",
      Authorization: `Bearer ${token}`,
    };

    const res = await axios.get(
      `${LINE_API}/profile/${userId}`,

      {
        headers,
      }
    );

    return res;
  } catch (err) {
    console.error("Error get user profile:", err);

    throw new Error(err);
  }
}

function checkUserIdExists(inputUserId) {
  return usersData.some((user) => user.id === inputUserId);
}

function deleteUserId(inputUserId) {
  return usersData.filter((user) => user.id !== inputUserId);
}

function evaluateScore(score, symptoms) {
  const resultSymptoms = displaySymptoms(symptoms);
  let symptomGroup, suggestion, imageURL;

  if (score >= 15) {
    symptomGroup = `ท่านอยู่ในกลุ่ม "เร่งด่วนมาก" ให้มาโรงพยาบาลทันที`;
    imageURL =
      "https://live.staticflickr.com/65535/53958595346_8208ed6f6e_c.jpg";
    suggestion =
      "คำแนะนำ หากท่านมีอาการดังกล่าว\nหากมีอาการข้อใดข้อหนึ่งท่านสามารถเข้ารับบริการที่โรงพยาบาลทันทีที่แผนกฉุกเฉินหรือโทรศัพท์ 1669";
    return { symptomGroup, suggestion, imageURL };
  }
  if (score >= 7) {
    symptomGroup = `ท่านมีอาการ\n${resultSymptoms}\nท่านอยู่ในกลุ่ม "เร่งด่วน" ให้มาตรวจรักษาก่อนนัดหมาย`;
    imageURL =
      "https://live.staticflickr.com/65535/53957664967_7f1888cda6_c.jpg";
    suggestion =
      "คำแนะนำ หากท่านมีอาการดังกล่าว\nให้มาตรวจรักษาก่อนนัดหมายโดยนำใบนัดหมายเดิมมาด้วย";
    return { symptomGroup, suggestion, imageURL };
  }
  symptomGroup = `ท่านมีอาการ\n${resultSymptoms}\nท่านอยู่ในกลุ่ม "กึ่งเร่งด่วน"`;

  imageURL = "https://live.staticflickr.com/65535/53958880314_0cfd1756a1_c.jpg";
  suggestion =
    "คำแนะนำ หากท่านมีอาการดังกล่าว\n1. ให้นอนพักมากๆ ประเมินอาการซ้ำวันรุ่งขึ้น\n2. ประทานอาหาร และเครื่องดื่มที่ย่อยง่าย ไม่ควรฝืนรับประทาน หาก รู้สึกคลื่นไส้ ให้รับประทานอาหารมื้อละน้อยๆ แต่ บ่อยๆ รักษาความสะอาดในช่องปากและทำความ สะอาดช่องปากหลังรับประทานอาหาร\n3. ให้ทำการยืดเหยียด กระดกปลายเท้าขึ้นและนวดที่น่องเพื่อผ่อนคลาย หากไม่ดีขึ้นให้ทำการประคบร้อน โดยปกติอาการควรดีขึ้นภายใน 1 - 2 นาที ในผู้ที่มีอาการถี่มากกว่า 3 ครั้งต่อสัปดาห์ควรพบแพทย์\n4. ให้มาตรวจตามนัดหมายโดยนำใบนัดหมายมาหากมีคำสั่งเจาะเลือดตรวจปัสสาวะ สามารถตรวจเลือดและปัสสาวะล่วงหน้าได้ 1 - 2 วัน";
  return { symptomGroup, suggestion, imageURL };
}

function displaySymptoms(symptoms) {
  const res = symptoms.map(
    (symp, index) => `${index + 1}. ${symp.text.split(". ")[1]}\n`
  );

  return res.join("") || "ไม่มีอาการใดๆที่กล่าวมา\n";
}

async function _getGoogleSheetClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: serviceAccountKeyFile,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const authClient = await auth.getClient();
  return google.sheets({
    version: "v4",
    auth: authClient,
  });
}

async function _readGoogleSheet(googleSheetClient, sheetId, tabName, range) {
  const res = await googleSheetClient.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tabName}!${range}`,
  });

  return res.data.values;
}

async function _writeGoogleSheet(
  googleSheetClient,
  sheetId,
  tabName,
  range,
  data
) {
  await googleSheetClient.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${tabName}!${range}`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    resource: {
      majorDimension: "ROWS",
      values: data,
    },
  });
}

app.get("/", (req, res) => res.send("Express on Vercel"));

app.post("/webhook", async (req, res) => {
  try {
    const { events } = req.body;

    if (!events || events.length === 0) {
      return res.json({ message: "Succesful connect to webhook" });
    }
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const webhookEventObject = events[0];
    const userId = webhookEventObject.source.userId;

    //Init state
    console.log("object webhook", webhookEventObject);
    if (webhookEventObject.message.type === "text") {
      if (webhookEventObject.message.text === "สอบถามเพิ่มเติม") {
        await sendMessage(
          userId,
          [
            {
              type: "text",
              text: "สามารถสอบถามเข้ามาได้เลย",
            },
          ],

          token
        );
        return res.json({ message: "Success" });
      } else if (webhookEventObject.message.text === "ช่องทางติดต่อ") {
        await sendMessage(
          userId,
          [
            {
              type: "text",
              text: "เบอร์โทร 056219888 ต่อ 11106\nห้องตรวจแผนกอายุรกรรม\nโรงพยาบาลสวรรค์ประชารักษ์",
            },
          ],

          token
        );
        return res.json({ message: "Success" });
      } else if (!checkUserIdExists(userId)) {
        if (webhookEventObject.message.text === "แบบคัดกรองผู้ป่วย") {
          usersData = [
            ...usersData,
            {
              id: userId,
              score: 0,
              questionIndex: 0,
              symptoms: [],
              appoint: false,
              appointDate: "",
              doctor: "",
            },
          ];
        } else {
          await sendMessage(
            userId,
            [
              {
                type: "text",
                text: "ท่านพิมพ์คำสั่งไม่ถูกต้อง กรุณาพิมพ์ใหม่ด้วยครับ",
              },
            ],

            token
          );
          return res.json({ message: "Wrong command!" });
        }
      }

      const [filterUsers] = usersData.filter((user) => user.id === userId);
      if (!filterUsers) {
        await sendMessage(
          userId,
          [
            {
              type: "text",
              text: "You have not started screening. Please type 'แบบคัดกรองผู้ป่วย' to start.",
            },
          ],
          token
        );
        return; // Exit if user data is not found
      }
      if (filterUsers.questionIndex === 0) {
        if (webhookEventObject.message.text === "ใช่") {
          filterUsers.appoint = true;
          filterUsers.questionIndex += 1;
        } else if (webhookEventObject.message.text === "ไม่") {
          filterUsers.appoint = false;
          filterUsers.questionIndex += 3;
        }
      } else if (filterUsers.questionIndex === 1 && filterUsers.appoint) {
        filterUsers.appointDate = webhookEventObject.message.text;
        filterUsers.questionIndex += 1;
      } else if (filterUsers.questionIndex === 2 && filterUsers.appoint) {
        const mappingDoctorNumber = {
          1: "พญ.รัชนี เชี่ยวชาญธนกิจ",
          2: "พญ. พิมพ์อนงค์ ภู่เหลือ",
          3: "พญ.วิภาวี ฮั่นตระกูล",
          4: "พญ.ธิดารัตน์ ลักษณานันท์",
          5: "พญ. วิภาดา ส่งวัฒนา",
        };
        filterUsers.doctor =
          mappingDoctorNumber[webhookEventObject.message.text];
        filterUsers.questionIndex += 1;
      } else if (webhookEventObject.message.text === "ใช่") {
        filterUsers.score += sequenceQuestion[filterUsers.questionIndex].score;
        const [desQuestionArray] =
          sequenceQuestion[filterUsers.questionIndex].question;
        filterUsers.symptoms = [...filterUsers.symptoms, desQuestionArray];

        filterUsers.questionIndex += 1;
      } else if (webhookEventObject.message.text === "ไม่") {
        filterUsers.questionIndex += 1;
      }
      if (filterUsers.questionIndex > 9 || filterUsers.score >= 15) {
        const googleSheetClient = await _getGoogleSheetClient();
        const date = new Date();
        const showDate = formatDate(date.toLocaleDateString());
        const { data: userProfile } = await getUserProfile(userId, token);
        const { symptomGroup, suggestion, imageURL } = evaluateScore(
          filterUsers.score,
          filterUsers.symptoms
        );
        console.log("iamgeg", imageURL);

        const responseMessage = [
          {
            type: "text",
            text: symptomGroup,
          },
          {
            type: "image",
            originalContentUrl: imageURL,
            previewImageUrl: imageURL,
          },
        ];

        if (filterUsers.appoint) {
          const appointInfo = `มีการนัดหมาย\n${filterUsers.doctor}\nวันที่นัดหมาย ${filterUsers.appointDate}`;
          responseMessage.push({ type: "text", text: appointInfo });
        }

        const dataToBeInserted = [
          [
            `${showDate} ${date.toLocaleTimeString()}`,
            userProfile.displayName,
            symptomGroup,
            filterUsers.doctor,
            filterUsers.appointDate,
          ],
        ];
        await _writeGoogleSheet(
          googleSheetClient,
          sheetId,
          tabName,
          range,
          dataToBeInserted
        );
        await sendMessage(userId, responseMessage, token);

        usersData = deleteUserId(userId);
        return;
      }
      //Start ask question

      //Additonal question

      const userMessageText =
        sequenceQuestion[filterUsers.questionIndex].question;

      await sendMessage(userId, userMessageText, token);
    }

    return res.json({
      message: "Response to LINE Platform",
    });
  } catch (err) {
    console.error("Error handling request:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
