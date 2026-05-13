const express = require("express");
const path = require("path");

const app = express();

// раздаёт ВСЮ папку как статическую (как Live Server)
app.use(express.static(path.join(__dirname)));

app.listen(3000, "0.0.0.0", () => {
  console.log("Server: http://localhost:3000");
});