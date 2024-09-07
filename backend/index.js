require("dotenv").config();
const config = require("./config.json");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
mongoose
  .connect(config.connectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("DB connected"))
  .catch((err) => console.error("DB connection error:", err));

//add schema db
const User = require("./models/user.model");
const Note = require("./models/note.model.js");

const express = require("express");
const cors = require("cors");
const app = express();

const jwt = require("jsonwebtoken");
const { authenticateToken } = require("./utilities");

app.use(express.json());

app.use(
  cors({
    origin: "*",
  })
);

app.get("/", (req, res) => {
  res.json({ data: "hello" });
});

//create account
app.post("/create-account", async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName) {
    return res
      .status(400)
      .json({ error: true, message: "Full Name is required" });
  }

  if (!email) {
    return res.status(400).json({ error: true, message: "Email is required" });
  }

  if (!password) {
    return res
      .status(400)
      .json({ error: true, message: "Password is required" });
  }

  const isUser = await User.findOne({ email: email });

  if (isUser) {
    return res.json({
      error: true,
      message: "Email already exists",
    });
  }
  const hashedPassword = await bcrypt.hash(password, 10); // Hash password
  const user = new User({
    fullName,
    email,
    password: hashedPassword,
  });

  await user.save();

  const accessToken = jwt.sign(
    { userId: user._id },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: "1h", // 1 hour
    }
  );

  res.json({
    error: false,
    user,
    message: "Account created successfully",
    accessToken,
  });
});

//login

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: true, message: "Email is required" });
  }
  if (!password) {
    return res
      .status(400)
      .json({ error: true, messages: "Password is required" });
  }
  const userInfo = await User.findOne({ email: email });

  if (!userInfo) {
    return res.status(404).json({ error: true, message: "User not found" });
  }
  const match = await bcrypt.compare(password, userInfo.password);

  if (!match) {
    return res
      .status(401)
      .json({ error: true, message: "Invalid credentials" });
  }

  if (userInfo.email == email && userInfo.password == password) {
    const user = { user: userInfo };

    const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "1h", // 1 hour
    });

    return res.json({
      error: false,
      message: "Login Successful",
      email,
      accessToken,
    });
  } else {
    return res
      .status(401)
      .json({ error: true, message: "Invalid credentials" });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email) {
    return res.status(400).json({ error: true, message: "Email is required" });
  }
  if (!password) {
    return res
      .status(400)
      .json({ error: true, message: "Password is required" });
  }

  try {
    const userInfo = await User.findOne({ email: email });

    if (!userInfo) {
      return res.status(404).json({ error: true, message: "User not found" });
    }

    const match = await bcrypt.compare(password, userInfo.password);

    if (!match) {
      return res
        .status(401)
        .json({ error: true, message: "Invalid credentials" });
    }

    const accessToken = jwt.sign(
      { _id: userInfo._id },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: "1h", // 1 hour
      }
    );

    return res.json({
      error: false,
      message: "Login Successful",
      email: userInfo.email,
      accessToken,
    });
  } catch (error) {
    return res.status(500).json({ error: true, message: error.message });
  }
});

//get user ..fix problem
app.get("/get-user", authenticateToken, async (req, res) => {
  const { user } = req.user;
  const isUser = await User.findOne({ _id: user._id });
  if (!isUser) {
    return res.status(404).json({ error: true, message: "User not found" });
  }
  return res.json({
    user: {
      fullName: isUser.fullName,
      email: isUser.email,
      _id: isUser._id,
      createdOn: isUser.createdOn,
    },
    message: "",
  });
});

//add Note

app.post("/add-note", authenticateToken, async (req, res) => {
  const { title, content, tags } = req.body;
  const user = req.user;

  if (!title) {
    return res.status(400).json({ error: true, message: "Title is required" });
  }
  if (!content) {
    return res
      .status(400)
      .json({ error: true, message: "Content is required" });
  }

  try {
    const note = new Note({
      title,
      content,
      tags: tags || [],
      userId: user.userId,
    });

    await note.save();

    return res.json({
      error: false,
      note,
      message: "Note added successfully",
    });
  } catch (error) {
    return res.status(500).json({ error: true, message: error.message });
  }
});

//edit note
app.put("/edit-note/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { title, content, tags, isPinned } = req.body;
  const user = req.user;

  if (!title && !content && !tags) {
    return res.status(400).json({ error: true, message: "No change Provided" });
  }

  try {
    const note = await Note.findOne({ _id: noteId, userId: user.userId });

    if (!note) {
      return res.status(404).json({ error: true, message: "Note not found" });
    }

    if (title) {
      note.title = title;
    }
    if (content) {
      note.content = content;
    }
    if (tags) {
      note.tags = tags;
    }
    if (isPinned) {
      note.isPinned = isPinned;
    }
    await note.save();
    return res.json({
      error: false,
      note,
      message: "Note updated successfully",
    });
  } catch (error) {
    return res.status(500).json({ error: true, message: error.message });
  }
});

//get all note //fix problem
app.get("/get-all-notes", authenticateToken, async (req, res) => {
  const user = req.user;
  console.log(user);

  try {
    const notes = await Note.find({ userId: user._id }).sort({
      isPinned: -1,
    });
    return res.json({
      error: false,
      notes,
      message: "Notes fetched successfully",
    });
  } catch {
    return res.status(500).json({ error: true, message: error.message });
  }
});

//delete Note ..fix problem
app.delete("/delete-note/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const user = req.user;

  try {
    const note = await Note.findOne({ _id: noteId, userId: user.userId });

    if (!note) {
      return res.status(404).json({ error: true, message: "Note not found" });
    }

    // delete note
    await Note.deleteOne({ _id: noteId, userId: user._id });

    return res.json({
      error: false,
      message: "Note deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ error: true, message: error.message });
  }
});

//update note pinned ...fix problem
app.put("/update-note-pinned/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { isPinned } = req.body;
  const user = req.user;

  try {
    const note = await Note.findOne({ _id: noteId, userId: user.userId });

    if (!note) {
      return res.status(404).json({ error: true, message: "Note not found" });
    }

    note.isPinned = isPinned;
    await note.save();
    return res.json({
      error: false,
      note,
      message: "Note updated successfully",
    });
  } catch (error) {
    return res.status(500).json({ error: true, message: error.message });
  }
});

//search notes ...fix problem
app.get("/search-notes/", authenticateToken, async (req, res) => {
  const { user } = req.user;
  const { query } = req.query;
  if (!query) {
    return res
      .status(400)
      .json({ error: true, message: "Search query is required" });
    try {
      const matchingNotes = await Note.find({
        $or: [
          { title: { $regex: new RegExp(query, "i") } },
          { content: { $regex: new RegExp(query, "i") } },
        ],
      });

      return res.json({
        error: false,
        notes: matchingNotes,
        message: "Search results found",
      });
    } catch (error) {
      return res
        .status(500)
        .json({ error: true, message: "Interval Server Error" });
    }
  }
});

//
app.listen(5000);

module.exports = app;
