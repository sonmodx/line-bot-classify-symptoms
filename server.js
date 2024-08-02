const { default: axios } = require("axios");
const express = require("express");
const app = express();

app.use(express.json());
require("dotenv").config();

const PORT = "3000";
const LINE_API = "https://api.line.me/v2/bot";

let usersData = [];
console.log("USER DATA:", usersData);

const sequenceQuestion = [
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
  console.log("first", message);
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
    // console.log("response sendmsg", res);
    return res;
  } catch (err) {
    throw new Error(err);
  }
};

function checkUserIdExists(inputUserId) {
  return usersData.some((user) => user.id === inputUserId);
}

function deleteUserId(inputUserId) {
  return usersData.filter((user) => user.id !== inputUserId);
}

function evaluateScore(score) {
  if (score >= 15) {
    return "ท่านอยู่ในกลุ่ม เร่งด่วนมาก ให้มาโรงพยาบาลทันที\nคำแนะนำ หากท่านมีอาการดังกล่าว\nหากมีอาการข้อใดข้อหนึ่งท่านสามารถเข้ารับบริการที่โรงพยาบาลทันทีที่แผนกฉุกเฉินหรือโทรศัพท์ 1669";
  }
  if (score >= 7) {
    return "ท่านอยู่ในกลุ่ม เร่งด่วน ให้มาตรวจรักษาก่อนนัดหมาย\nคำแนะนำ หากท่านมีอาการดังกล่าว\nให้มาตรวจรักษาก่อนนัดหมายโดยนำใบนัดหมายเดิมมาด้วย";
  }
  return "ท่านอยู่ในกลุ่ม กึ่งเร่งด่วน\nคำแนะนำ หากท่านมีอาการดังกล่าว\n1. ให้นอนพักมากๆ ประเมินอาการซ้ำวันรุ่งขึ้น\n2. ประทานอาหาร และเครื่องดื่มที่ย่อยง่าย ไม่ควรฝืนรับประทาน หาก รู้สึกคลื่นไส้ ให้รับประทานอาหารมื้อละน้อยๆ แต่ บ่อยๆ รักษาความสะอาดในช่องปากและทำความ สะอาดช่องปากหลังรับปะทานอาหาร\n3. ให้ทำการยืดเหยียด กระดกปลายเท้าขึ้นและนวดที่น่องเพื่อผ่อนคลาย หากไม่ดีขึ้นให้ทำการประคบร้อน โดยปกติอาการควรดีขึ้นภายใน 1 - 2 นาที ในผู้ที่มีอาการถี่มากกว่า 3 ครั้งต่อสัปดาห์ควรพบแพทย์\n4. ให้มาตรวจตามนัดหมายโดยนำใบนัดหมายมาหากมีคำสั่งเจาะเลือดตรวจปัสสาวะ สามารถตรวจเลือดและปัสสาวะล่วงหน้าได้ 1 - 2 วัน";
}

app.post("/webhook", async (req, res) => {
  try {
    const { events } = req.body;
    console.log("events", events);
    if (!events || events.length === 0) {
      return res.json({ message: "Succesful connect to webhook" });
    }
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const webhookEventObject = events[0];
    const userId = webhookEventObject.source.userId;
    //U12909875dbef6df2de5e8ea9f8f87e6f
    //Init state
    if (webhookEventObject.message.type === "text") {
      if (!checkUserIdExists(userId)) {
        if (webhookEventObject.message.text === "แบบคัดกรองผู้ป่วย") {
          usersData = [
            ...usersData,
            {
              id: userId,
              score: 0,
              questionIndex: 0,
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
        }
        console.log("new user?");
      }

      console.log("User data:", usersData);
      const [filterUsers] = usersData.filter((user) => user.id === userId);

      if (webhookEventObject.message.text === "ใช่") {
        filterUsers.score += sequenceQuestion[filterUsers.questionIndex].score;
        filterUsers.questionIndex += 1;
      } else if (webhookEventObject.message.text === "ไม่") {
        filterUsers.questionIndex += 1;
      }
      if (filterUsers.questionIndex > 6 || filterUsers.score >= 15) {
        await sendMessage(
          userId,
          [
            {
              type: "text",
              text: evaluateScore(filterUsers.score),
            },
          ],
          token
        );
        usersData = deleteUserId(userId);
        return;
      }
      const userMessageText =
        sequenceQuestion[filterUsers.questionIndex].question;
      console.log("user:", filterUsers);

      await sendMessage(userId, userMessageText, token);
    }

    return res.json({
      message: "Response to LINE Platform",
    });
  } catch (err) {
    console.log(err);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
