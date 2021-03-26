// Import the packages

const express = require("express");
const router = express.Router();
const createStripe = require("stripe");
const formidableMiddleware = require("express-formidable");
router.use(formidableMiddleware());
const stripe = createStripe(process.env.STRIPE_SECRET);

router.post("/payment", async (req, res) => {
  try {
    // we send the token to Stripe with the amount
    let { status } = await stripe.charges.create({
      amount: req.fields.amount * 100,
      currency: "eur",
      description: `Paiement vinted pour : ${req.fields.title}`,
      source: req.fields.token,
    });
    // The payment worked
    // We can update the database
    // We send a response back to the customer to display a status message
    res.json({ status });
  } catch (error) {
    console.log(error.message);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
