// Import the packages

const express = require("express");
const router = express.Router();
const cloudinary = require("cloudinary").v2;
const isAuthenticated = require("../middlewares/isAuthenticated");

// Import the User and Offer model
const User = require("../models/User");
const Offer = require("../models/Offer");

//  Route of publication of an advertisement.
router.post("/offer/publish", isAuthenticated, async (req, res) => {
  try {
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

    // Create a new ad
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

    // Send the image to cloudinary
    const result = await cloudinary.uploader.upload(req.files.picture.path, {
      folder: `/vinted/offers/${newOffer._id}`,
    });

    // Add the image in newOffer
    newOffer.product_image = result;
    // Save the ad
    await newOffer.save();

    res.status(200).json(newOffer);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Route which allows you to retrieve the information of an offer according to its id
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

// Route used to modify the advertisement.
router.put("/offer/update/:id", isAuthenticated, async (req, res) => {
  const offerModify = await Offer.findById(req.params.id);

  try {
    if (req.fields.title) {
      offerModify.product_name = req.fields.title;
    }
    if (req.fields.description) {
      offerModify.product_description = req.fields.description;
    }
    if (req.fields.price) {
      offerModify.product_price = req.fields.price;
    }

    const details = offerModify.product_details;
    // I create a loop to get all the product information and modify it.
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

    // Notify Mongoose that we have modified the product_details array
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

// Route that allows you to delete the ad.
router.delete("/offer/delete/:id", isAuthenticated, async (req, res) => {
  try {
    // I delete what is in the folder
    await cloudinary.api.delete_resources_by_prefix(
      `vinted/offers/${req.params.id}`
    );
    // Once the folder is empty, I can delete it!
    await cloudinary.api.delete_folder(`vinted/offers/${req.params.id}`);

    offerToDelete = await Offer.findById(req.params.id);

    await offerToDelete.delete();

    res.status(200).json("Offer deleted succesfully !");
  } catch (error) {
    console.log(error.message);
    res.status(400).json({ error: error.message });
  }
});

// Route that allows us to retrieve a list of advertisements based on filters
router.get("/offers", async (req, res) => {
  try {
    // Create an object in which we will store our different filters
    let filters = {};

    // If I receive a query title
    if (req.query.title) {
      // I add a product_name key to the filters object
      filters.product_name = new RegExp(req.query.title, "i");
      // "i" ignore the box of our characters
      // Regexp, search the entire title.
    }

    // If I receive a priceMin query
    if (req.query.priceMin) {
      // I add a product_price key to the filters object
      filters.product_price = {
        $gte: Number(req.query.priceMin),
        // retrieve the products that are greater than or equal.
      };
    }

    if (req.query.priceMax) {
      // I check if I already have a product price key to be able to filter by pricemin and pricemax at the same time
      if (filters.product_price) {
        filters.product_price.$lte = Number(req.query.priceMax);
        // Modify the product price object with the key $ lte
      } else {
        // If I don't have a key, I create it
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
    // force to display page 1 if the query page is not sent or is sent with 0 or < -1
    if (req.query.page < 1) {
      page = 1;
    } else {
      // otherwise, page is equal to what is requested
      page = Number(req.query.page);
      // A Query always returns a character string
    }

    // SKIP = ignore the first n results
    // The user requests page 1 (we ignore the first 0 results)
    // (page - 1) * limit = 0

    // The user requests page 2 (we ignore the limit first results)
    // (page - 1) * limit = 5 (if limit = 5)

    let limit = Number(req.query.limit);

    // Returns the number of results found according to the filters
    const count = await Offer.countDocuments(filters);

    const offers = await Offer.find(filters)
      .populate({
        path: "owner",
        select: "account",
      })
      .sort(sort)
      .skip((page - 1) * limit) // ignore x number of results.
      .limit(limit) // return x number of results.
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
