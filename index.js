import express from "express";
import Stripe from "stripe";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import crypto from "crypto";

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* ================================
   STRIPE WEBHOOK
================================ */
app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const metadata = session.metadata || {};

    // 📩 EMAIL interne
    await sendInternalSubscriptionEmail({
      source: "Stripe",
      offre: metadata.offre,
      billingType: metadata.billingType,
      nom: metadata.nom,
      telephone: metadata.telephone,
      email: metadata.email,
      adresse: metadata.adresse,
      appareil: metadata.appareil,
      contractSigned: metadata.contractSigned,
      cgvAccepted: metadata.cgvAccepted,
      sepaAccepted: metadata.sepaAccepted,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      stripeSessionId: session.id,
      paymentStatus: session.payment_status,
    });

    // 🚀 ENVOI META (LE PLUS IMPORTANT)
    await sendMetaPurchase(session);
  }

  res.json({ received: true });
});

app.use(cors());
app.use(express.json());

/* ================================
   EMAIL
================================ */
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendInternalSubscriptionEmail(data) {
  const subject = `Nouvelle souscription - ${data.offre}`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: process.env.MAIL_TO,
    subject,
    text: JSON.stringify(data, null, 2),
  });
}

/* ================================
   🔥 META CONVERSIONS API
================================ */
async function sendMetaPurchase(session) {
  try {
    const metadata = session.metadata || {};

    const hash = (value) =>
      crypto
        .createHash("sha256")
        .update(value.trim().toLowerCase())
        .digest("hex");

    const payload = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",

          user_data: {
            em: metadata.email ? hash(metadata.email) : undefined,
            ph: metadata.telephone ? hash(metadata.telephone) : undefined,
          },

          custom_data: {
            currency: "EUR",
            value: 1,
            content_name: metadata.offre,
            content_category:
              metadata.billingType === "month" ? "Mensuel SEPA" : "Annuel",
          },
        },
      ],
    };

    // ⚠️ MODE TEST (à enlever ensuite)
    if (process.env.META_TEST_EVENT_CODE) {
      payload.test_event_code = process.env.META_TEST_EVENT_CODE;
    }

    const url = `https://graph.facebook.com/v18.0/${process.env.META_PIXEL_ID}/events?access_token=${process.env.META_ACCESS_TOKEN}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    console.log("META EVENT SENT:", result);
  } catch (error) {
    console.error("META ERROR:", error);
  }
}

/* ================================
   CHECKOUT STRIPE
================================ */
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
    } = req.body;

    const priceMap = {
      ESSENTIEL: {
        year: "price_1TOB7HJgCRDL7Cgv16QqokK5",
        month: "price_1TNSOgJgCRDL7Cgv4AEkyrX3",
      },
      CONFORT: {
        year: "price_1TOB6HJgCRDL7CgvV114Q2kh",
        month: "price_1TNSPlJgCRDL7Cgvf211mea2",
      },
      SERENITE: {
        year: "price_1TOB5FJgCRDL7CgvH9Tmcb5f",
        month: "price_1TNSRHJgCRDL7CgvRGVIqOS7",
      },
    };

    const priceId = priceMap[offer]?.[billingType];

if (!priceId) {
  return res.status(400).json({ error: "Prix invalide" });
}

    const session = await stripe.checkout.sessions.create({
      payment_method_types:
        billingType === "month" ? ["sepa_debit"] : ["card"],
      mode: "subscription",
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],

      success_url:
        "https://souscrire.toutfeutoutflamme31.fr/?checkout=success",
      cancel_url:
        "https://souscrire.toutfeutoutflamme31.fr/?checkout=cancel",

      metadata: {
        nom,
        telephone,
        email,
        adresse,
        appareil,
        offre: offer,
        billingType,
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* ================================
   SERVER
================================ */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log("Server running on " + PORT));
