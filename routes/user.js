//Import des packages

const express = require("express");
const router = express.Router();
const uid2 = require("uid2");
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const cloudinary = require("cloudinary").v2;

//Import du model User et Offer
const User = require("../models/User");
const Offer = require("../models/Offer");

// Route qui permet de s'inscrire sur le site.
router.post("/user/signup", async (req, res) => {
  try {
    //On recherche si l'email existe déjà dans la base de données.
    const user = await User.findOne({ email: req.fields.email });

    if (!user) {
      // Si l'email n'est pas trouvé, je crée un nouvel utilisateur
      // Si je recois Email, Username , Password, je continue la création
      if (req.fields.email && req.fields.username && req.fields.password) {
        //Encrypter le mot de passe
        const salt = uid2(64);
        const hash = SHA256(req.fields.password + salt).toString(encBase64);
        const token = uid2(64);
        //Créer le nouvel utilisateur
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
          // Envoyer l'image de l'avatar à cloudinary
          const result = await cloudinary.uploader.upload(
            req.files.avatar.path,
            {
              folder: `/vinted/users/${newUser._id}`,
            }
          );
          newUser.account.avatar = result;
        }
        //Sauvegarde de l'utilisateur
        await newUser.save();
        //Répondre au client
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
      // 409 	Conflict 	La requête ne peut être traitée en l’état actuel.
      res.status(409).json({ message: "This email already has an account" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Route qui permet de se connecter sur le site.
router.post("/user/login", async (req, res) => {
  try {
    //On recherche si l'email existe déjà dans la base de données.
    const user = await User.findOne({ email: req.fields.email });
    if (user) {
      // générer un nouveau hash avec le password rentré + le salt de l'utilisateur trouvé
      const newHash = SHA256(req.fields.password + user.salt).toString(
        encBase64
      );
      // Si ce hash est le même que le hash de l'utilisateur trouvé,on lui réponds.
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
        // 401 	Unauthorized 	Une authentification est nécessaire pour accéder à la ressource.
      }
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/user/update/:id", async (req, res) => {
  const userModify = await User.findById(req.params.id);

  // console.log(req.fields);
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
      // console.log(req.files.avatar);
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

// Route qui permet de supprimer l'utilisateur du site.
router.delete("/user/:id", async (req, res) => {
  try {
    // On recherche l'utilisateur à partir de son id et on le supprime :
    await User.deleteOne({ _id: req.params.id });
    // On répond au client :
    res.json({ message: "User deleted succesfully !" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
