import express from "express";
import Stripe from "stripe";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.ionos.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: Number(process.env.SMTP_PORT || 465) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendInternalSubscriptionEmail({
  source,
  offre,
  billingType,
  nom,
  telephone,
  email,
  adresse,
  appareil,
  contractSigned,
  cgvAccepted,
  sepaAccepted,
  stripeCustomerId,
  stripeSubscriptionId,
  stripeSessionId,
  paymentStatus,
}) {
  const isMonthly = billingType === "month";

  const subject = isMonthly
    ? `Nouvelle souscription mensuelle - ${offre}`
    : `Nouvelle souscription annuelle - ${offre}`;

  const text = `
Nouvelle souscription reçue

Source : ${source || ""}
Offre : ${offre || ""}
Type de facturation : ${isMonthly ? "Mensuel / SEPA" : "Annuel / Carte"}

Nom : ${nom || ""}
Téléphone : ${telephone || ""}
Email : ${email || ""}
Adresse : ${adresse || ""}
Appareil : ${appareil || ""}

Contrat accepté : ${contractSigned || ""}
CGV acceptées : ${cgvAccepted || ""}
Autorisation SEPA : ${sepaAccepted || ""}

Stripe customer ID : ${stripeCustomerId || ""}
Stripe subscription ID : ${stripeSubscriptionId || ""}
Stripe session ID : ${stripeSessionId || ""}
Statut paiement : ${paymentStatus || ""}

Date : ${new Date().toLocaleString("fr-FR")}
  `.trim();

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: process.env.MAIL_TO,
    subject,
    text,
  });
}

const PRICES = {
  ESSENTIEL_YEAR: "price_1TOB7HJgCRDL7Cgv16QqokK5",
  ESSENTIEL_MONTH: "price_1TNSOgJgCRDL7Cgv4AEkyrX3",
  CONFORT_YEAR: "price_1TOB6HJgCRDL7CgvV114Q2kh",
  CONFORT_MONTH: "price_1TNSPlJgCRDL7Cgvf211mea2",
  SERENITE_YEAR: "price_1TOB5FJgCRDL7CgvH9Tmcb5f",
  SERENITE_MONTH: "price_1TNSRHJgCRDL7CgvRGVIqOS7",
};

app.get("/api/test-mail", async (_req, res) => {
  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: process.env.MAIL_TO,
      subject: "Test mail IONOS",
      text: "Test OK depuis le backend Render.",
    });

    res.json({ ok: true, message: "Mail envoyé" });
  } catch (error) {
    console.error("Erreur test mail :", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/checkout", async (req, res) => {
  try {
    const {
      nom,
      telephone,
      email,
      adresse,
      appareil,
      offer,
      billingType,
      contractSigned,
      cgvAccepted,
      sepaAccepted,
    } = req.body;

    let priceId;

    if (offer === "ESSENTIEL" && billingType === "year") {
      priceId = PRICES.ESSENTIEL_YEAR;
    }
    if (offer === "ESSENTIEL" && billingType === "month") {
      priceId = PRICES.ESSENTIEL_MONTH;
    }
    if (offer === "CONFORT" && billingType === "year") {
      priceId = PRICES.CONFORT_YEAR;
    }
    if (offer === "CONFORT" && billingType === "month") {
      priceId = PRICES.CONFORT_MONTH;
    }
    if (offer === "SERENITE" && billingType === "year") {
      priceId = PRICES.SERENITE_YEAR;
    }
    if (offer === "SERENITE" && billingType === "month") {
      priceId = PRICES.SERENITE_MONTH;
    }

    if (!priceId) {
      return res.status(400).json({ error: "Prix invalide" });
    }

    const paymentMethods =
      billingType === "month" ? ["sepa_debit"] : ["card"];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: paymentMethods,
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url:
        "https://souscrire.toutfeutoutflamme31.fr/?checkout=success",
      cancel_url:
        "https://souscrire.toutfeutoutflamme31.fr/?checkout=cancel",
      metadata: {
        nom,
        telephone,
        adresse,
        appareil,
        email,
        offre: offer,
        billingType,
        contractSigned: String(contractSigned === true),
        cgvAccepted: String(cgvAccepted === true),
        sepaAccepted: String(sepaAccepted === true),
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("ERREUR STRIPE :", error);
    res.status(500).json({
      error: error.message || "Erreur Stripe",
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
