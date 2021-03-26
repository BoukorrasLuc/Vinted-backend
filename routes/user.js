// Import the packages

const express = require("express");
const router = express.Router();
const uid2 = require("uid2");
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const cloudinary = require("cloudinary").v2;

// Import the User and Offer model
const User = require("../models/User");
const Offer = require("../models/Offer");

// Route that allows you to register on the site.
router.post("/user/signup", async (req, res) => {
  try {
    // We search if the email already exists in the database.
    const user = await User.findOne({ email: req.fields.email });

    if (!user) {
      // If the email is not found, I create a new user
      // If I receive Email, Username, Password, I continue creating
      if (req.fields.email && req.fields.username && req.fields.password) {
        // Encrypt the password
        const salt = uid2(64);
        const hash = SHA256(req.fields.password + salt).toString(encBase64);
        const token = uid2(64);
        // Create the new user
        const newUser = new User({
          email: req.fields.email,
          account: {
            username: req.fields.username,
            phone: req.fields.phone,
          },
          token: token,
          hash: hash,
          salt: salt,
        });
        if (req.files.avatar) {
          const result = await cloudinary.uploader.upload(
            req.files.avatar.path,
            {
              folder: `/vinted/users/${newUser._id}`,
            }
          );
          newUser.account.avatar = result;
        }

        await newUser.save();
        res.status(200).json({
          _id: newUser._id,
          token: newUser.token,
          account: {
            username: newUser.account.username,
            phone: newUser.account.phone,
            email: newUser.email,
            avatar: newUser.account.avatar.secure_url,
          },
        });
      } else {
        res.status(400).json({ message: "Missing parameters" });
      }
    } else {
      res.status(409).json({ message: "This email already has an account" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Route that allows you to connect to the site.
router.post("/user/login", async (req, res) => {
  try {
    // We search if the email already exists in the database.
    const user = await User.findOne({ email: req.fields.email });
    if (user) {
      // generate a new hash with the entered password + the salt of the user found
      const newHash = SHA256(req.fields.password + user.salt).toString(
        encBase64
      );
      // If this hash is the same as the hash of the user found, we respond to it.
      if (newHash === user.hash) {
        res.status(200).json({
          _id: user._id,
          token: user.token,
          account: {
            username: user.account.username,
            phone: user.account.phone,
            avatar: user.account.avatar,
          },
        });
      } else {
        res.status(401).json({ message: "Unauthorized" });
      }
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Route which allows to update the user of the site.
router.put("/user/update/:id", async (req, res) => {
  const userModify = await User.findById(req.params.id);

  try {
    if (req.fields.username) {
      userModify.account.username = req.fields.username;
    }
    if (req.fields.phone) {
      userModify.account.phone = req.fields.phone;
    }
    if (req.fields.email) {
      userModify.email = req.fields.email;
    }

    if (req.files.avatar) {
      const result = await cloudinary.uploader.upload(req.files.avatar.path, {
        public_id: `vinted/users/${userModify._id}`,
      });
      userModify.account.avatar = result;
    }

    await userModify.save();

    res.status(200).json("User modified succesfully !");
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Route that allows you to delete the user from the site.
router.delete("/user/:id", async (req, res) => {
  try {
    await User.deleteOne({ _id: req.params.id });

    res.json({ message: "User deleted succesfully !" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
