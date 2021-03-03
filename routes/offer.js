//Import des packages

const express = require("express");
const router = express.Router();
const cloudinary = require("cloudinary").v2;
const isAuthenticated = require("../middlewares/isAuthenticated");

//Import du model User et Offer
const User = require("../models/User");
const Offer = require("../models/Offer");

// Route de publication d'une annonce.
router.post("/offer/publish", isAuthenticated, async (req, res) => {
  try {
    // const title = req.fields.title
    // const size = req.fields.size
    // const description = req.fields.description
    // const price = req.fields.price
    // const brand = req.fields.brand
    // const city = req.fields.city
    // const condition = req.fields.condition
    // const color = req.fields.color

    // Destructuring
    const {
      title,
      description,
      price,
      size,
      brand,
      condition,
      city,
      color,
    } = req.fields;

    // Créer une nouvelle annonce
    const newOffer = new Offer({
      product_name: title,
      product_description: description,
      product_price: price,
      product_details: [
        {
          MARQUE: brand,
        },
        {
          TAILLE: size,
        },
        {
          ÉTAT: condition,
        },
        {
          COULEUR: color,
        },
        {
          EMPLACEMENT: city,
        },
      ],

      owner: req.user,
    });

    // Envoyer l'image à cloudinary
    const result = await cloudinary.uploader.upload(req.files.picture.path, {
      folder: `/vinted/offers/${newOffer._id}`,
    });

    // Ajout de l'image dans newOffer
    newOffer.product_image = result;
    // Sauvegarder l'annonce
    await newOffer.save();

    // Répondre au client
    res.status(200).json(newOffer);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Route qui permet de récupérer les informations d'une offre en fonction de son id
router.get("/offer/:id", async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id).populate({
      path: "owner",
      select: "account.username account.phone account.avatar",
    });
    res.json(offer);
  } catch (error) {
    console.log(error.message);
    res.status(400).json({ message: error.message });
  }
});

// Route qui permet de modifier l'annonce.
router.put("/offer/update/:id", isAuthenticated, async (req, res) => {
  const offerModify = await Offer.findById(req.params.id);

  try {
    //Si je recois la query title
    if (req.fields.title) {
      // la future modification de la clé product name est égal la query title
      offerModify.product_name = req.fields.title;
    }
    if (req.fields.description) {
      offerModify.product_description = req.fields.description;
    }
    if (req.fields.price) {
      offerModify.product_price = req.fields.price;
    }

    const details = offerModify.product_details;
    // Je crée une boucle pour avoir toute les informations du produit et les modifier.
    for (i = 0; i < details.length; i++) {
      if (details[i].MARQUE) {
        if (req.fields.brand) {
          details[i].MARQUE = req.fields.brand;
        }
      }
      if (details[i].TAILLE) {
        if (req.fields.size) {
          details[i].TAILLE = req.fields.size;
        }
      }
      if (details[i].ÉTAT) {
        if (req.fields.condition) {
          details[i].ÉTAT = req.fields.condition;
        }
      }
      if (details[i].COULEUR) {
        if (req.fields.color) {
          details[i].COULEUR = req.fields.color;
        }
      }
      if (details[i].EMPLACEMENT) {
        if (req.fields.location) {
          details[i].EMPLACEMENT = req.fields.location;
        }
      }
    }

    // Notifie Mongoose que l'on a modifié le tableau product_details
    offerModify.markModified("product_details");

    if (req.files.picture) {
      const result = await cloudinary.uploader.upload(req.files.picture.path, {
        public_id: `vinted/offers/${offerModify._id}/preview`,
      });
      offerModify.product_image = result;
    }

    await offerModify.save();

    res.status(200).json("Offer modified succesfully !");
  } catch (error) {
    console.log(error.message);
    res.status(400).json({ error: error.message });
  }
});

// Route qui permet de supprimer l'annonce.
router.delete("/offer/delete/:id", isAuthenticated, async (req, res) => {
  try {
    //Je supprime ce qui il y a dans le dossier
    await cloudinary.api.delete_resources_by_prefix(
      `vinted/offers/${req.params.id}`
    );
    //Une fois le dossier vide, je peux le supprimer !
    await cloudinary.api.delete_folder(`vinted/offers/${req.params.id}`);

    offerToDelete = await Offer.findById(req.params.id);

    await offerToDelete.delete();

    res.status(200).json("Offer deleted succesfully !");
  } catch (error) {
    console.log(error.message);
    res.status(400).json({ error: error.message });
  }
});

// Route qui nous permet de récupérer une liste d'annonces en fonction de filtres
router.get("/offers", async (req, res) => {
  try {
    //Création d'un objet dans lequel on va stocker nos différents filtres
    let filters = {};

    // Si je reçois une query title
    if (req.query.title) {
      // j'ajoute une clé product_name à l'objet filters
      filters.product_name = new RegExp(req.query.title, "i");
      //"i" ignore la case de nos caractères
      //Regexp, recherche dans l'ensemble du title.
    }

    // Si je reçois une query priceMin
    if (req.query.priceMin) {
      // j'ajoute une clé product_price à l'objet filters
      filters.product_price = {
        $gte: Number(req.query.priceMin),
        // récupérer les produits qui sont superieur ou égal ..
      };
    }

    if (req.query.priceMax) {
      // Je vérifie si j'ai déjà une clé product price pour pouvoir filtrer par pricemin et pricemax en même temps
      if (filters.product_price) {
        filters.product_price.$lte = Number(req.query.priceMax);
        //Modifier l'objet product price avec la clé $lte
      } else {
        // Si je n'ai pas de clé, je la crée
        filters.product_price = {
          $lte: Number(req.query.priceMax),
        };
      }
    }

    let sort = {};

    if (req.query.sort === "price-desc") {
      sort.product_price = -1;
    }
    if (req.query.sort === "price-asc") {
      sort.product_price = 1;
    }

    let page;
    // forcer à afficher la page 1 si la query page n'est pas envoyée ou est envoyée avec 0 ou < -1
    if (req.query.page < 1) {
      page = 1;
    } else {
      // sinon, page est égale à ce qui est demandé
      page = Number(req.query.page);
      // Une Query renvoie toujours une chaine de caractères
    }

    // SKIP = ignorer les n premiers résultats
    // L'utilisateur demande la page 1 (on ignore les 0 premiers résultats)
    // (page - 1) * limit = 0

    // L'utilisateur demande la page 2 (on ignore les limit premiers résultats)
    // (page - 1) * limit = 5 (si limit = 5)

    let limit = Number(req.query.limit);

    // Renvoie le nombre de résultats trouvés en fonction des filters
    const count = await Offer.countDocuments(filters);

    const offers = await Offer.find(filters)
      .populate({
        path: "owner",
        select: "account",
      })
      .sort(sort)
      .skip((page - 1) * limit) //ignorer un nombre x de résultats.
      .limit(limit) // renvoyer une nombre x de résultats.
      .select();
    res.status(200).json({
      count: count,
      offers: offers,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
