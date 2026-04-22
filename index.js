import express from "express";
import Stripe from "stripe";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 🔥 TES PRIX STRIPE
const PRICES = {
  ESSENTIEL_YEAR: "price_1TOB7HJgCRDL7Cgv16QqokK5",
  ESSENTIEL_MONTH: "price_1TNSOgJgCRDL7Cgv4AEkyrX3",
  CONFORT_YEAR: "price_1TOB6HJgCRDL7CgvV114Q2kh",
  CONFORT_MONTH: "price_1TNSPlJgCRDL7Cgvf211mea2",
  SERENITE_YEAR: "price_1TOB5FJgCRDL7CgvH9Tmcb5f",
  SERENITE_MONTH: "price_1TNSRHJgCRDL7CgvRGVIqOS7",
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
    success_url: "https://souscrire.toutfeutoutflamme31.fr/success",
    cancel_url: "https://souscrire.toutfeutoutflamme31.fr/cancel",

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
