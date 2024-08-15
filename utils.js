const formatDate = (date) => {
  const [month, day, year] = date.split("/");
  const paddedDay = day.padStart(2, "0");
  const paddedMonth = month.padStart(2, "0");
  const paddedYear = year.padStart(2, "0");
  console.log(`${paddedDay}/${paddedMonth}/${paddedYear}`);
  return `${paddedDay}/${paddedMonth}/${paddedYear}`;
};

module.exports = { formatDate };
