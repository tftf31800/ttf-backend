import express from "express";
import Stripe from "stripe";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const stripe = new Stripe(process.env.STRIPE_SECRET);

// 🔥 TES PRIX STRIPE
const PRICES = {
  ESSENTIEL_YEAR: "price_xxx",
  ESSENTIEL_MONTH: "price_xxx",
  CONFORT_YEAR: "price_xxx",
  CONFORT_MONTH: "price_xxx",
  SERENITE_YEAR: "price_xxx",
  SERENITE_MONTH: "price_xxx",
};

app.post("/api/checkout", async (req, res) => {
  const {
    nom,
    telephone,
    email,
    adresse,
    appareil,
    offer,
    billingType,
  } = req.body;

  let priceId;

  if (offer === "ESSENTIEL" && billingType === "year") priceId = PRICES.ESSENTIEL_YEAR;
  if (offer === "ESSENTIEL" && billingType === "month") priceId = PRICES.ESSENTIEL_MONTH;
  if (offer === "CONFORT" && billingType === "year") priceId = PRICES.CONFORT_YEAR;
  if (offer === "CONFORT" && billingType === "month") priceId = PRICES.CONFORT_MONTH;
  if (offer === "SERENITE" && billingType === "year") priceId = PRICES.SERENITE_YEAR;
  if (offer === "SERENITE" && billingType === "month") priceId = PRICES.SERENITE_MONTH;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: billingType === "month" ? "subscription" : "payment",
    customer_email: email,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: "https://TON-SITE.vercel.app/success",
    cancel_url: "https://TON-SITE.vercel.app/cancel",

    metadata: {
      nom,
      telephone,
      adresse,
      appareil,
      offre: offer,
    },
  });

  res.json({ url: session.url });
});

app.listen(3001, () => console.log("Server running"));
