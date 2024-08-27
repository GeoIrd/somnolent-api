require("dotenv").config();
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const { db } = require("./firebaseConfig");
const admin = require("firebase-admin");

const app = express();

// Middleware pentru redirecționarea de la HTTP la HTTPS
const forceHttps = (req, res, next) => {
  if (!req.secure && req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect("https://" + req.headers.host + req.url);
  }
  next();
};
app.use(forceHttps);

// Configurare CORS
const allowedOrigins = [
  "https://www.somnolentai.com",
  "https://somnolentai.com",
];
app.use(
  cors({
    origin: (origin, callback) => {
      if (allowedOrigins.includes(origin) || !origin) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

app.use(bodyParser.json());

// Configurare Helmet pentru securitate
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "https://apis.google.com",
          "https://js.stripe.com",
          "https://www.google.com/recaptcha/api.js",
          "https://www.gstatic.com/recaptcha/releases/",
          "https://somnolentai.com",
        ],
        styleSrc: [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com",
          "'unsafe-inline'",
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        connectSrc: [
          "'self'",
          "https://identitytoolkit.googleapis.com",
          "https://api.stripe.com",
        ],
        fontSrc: [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.gstatic.com",
        ],
        frameSrc: [
          "'self'",
          "https://js.stripe.com",
          "https://somnolentai-3b507.firebaseapp.com",
        ],
        imgSrc: ["'self'", "https://res.cloudinary.com", "data:"],
        manifestSrc: ["'self'"],
        mediaSrc: ["'self'"],
        workerSrc: ["'none'"],
        reportUri: "https://66c628d9a05c71ef2916207b.endpoint.csper.io/?v=2",
        upgradeInsecureRequests: [],
      },
    },
  })
);

// Endpoint pentru crearea unei sesiuni de checkout cu Stripe
app.post("/api/create-checkout-session", async (req, res) => {
  const { amount, credits, userId } = req.body;

  try {
    const intAmount = Math.floor(amount);
    const intCredits = Math.floor(credits) * 2;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "ron",
            product_data: {
              name: `Afla acum semnificatia ascunsa a viselor tale cumparand ${
                intCredits / 2
              } credit(e) noi!`,
              images: [
                "https://res.cloudinary.com/dsqwnuyiw/image/upload/v1711565459/home_shape_sxxfum.png",
              ],
            },
            unit_amount: intAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.BASE_URL}/success?user_id=${userId}&credits=${intCredits}`,
      cancel_url: `${process.env.BASE_URL}/buy-credits`,
      metadata: {
        userId: userId,
        credits: intCredits,
      },
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error(`Error creating checkout session for user ${userId}:`, error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// Endpoint pentru actualizarea creditelor utilizatorului
app.post("/api/update-credits", async (req, res) => {
  const { userId, credits } = req.body;

  try {
    const userDocRef = db.collection("users").doc(userId);
    await userDocRef.update({
      credits: admin.firestore.FieldValue.increment(credits),
    });

    res.status(200).json({ message: "Credits updated successfully" });
  } catch (error) {
    console.error("Error updating credits:", error);
    res.status(500).json({ error: "Failed to update credits" });
  }
});

// Servește aplicația React
app.use(express.static(path.join(__dirname, "build"))); // Servește fișierele statice din 'build'

// Redirecționează toate celelalte cereri către aplicația React
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
