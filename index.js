
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

dotenv.config();
const app = express();

// CORS
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "https://mihlievs.uz"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Uploads folder
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ok = allowed.test(file.mimetype) && allowed.test(path.extname(file.originalname).toLowerCase());
    ok ? cb(null, true) : cb(new Error("Only JPG, PNG, WebP allowed"));
  }
});

// Mongoose schema
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  variant: { type: String, required: true },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  category: { type: String, required: true },
  colors: [{ type: String }],
  rating: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },
  isNew: { type: Boolean, default: false },
  badge: { type: String },
  images: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

// Database
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => {
    console.error("Mongo Error:", err);
    process.exit(1);
  });

/* -------------------- ROUTES -------------------- */

// Create product
app.post('/api/products', upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ error: "Minimum 2 images required" });
    }

    const images = req.files.map(f => f.filename);

    const colors = typeof req.body.colors === "string"
      ? JSON.parse(req.body.colors)
      : req.body.colors || [];

    const product = new Product({
      name: req.body.name?.trim() || "",
      variant: req.body.variant?.trim() || "",
      price: Number(req.body.price),
      originalPrice: req.body.originalPrice ? Number(req.body.originalPrice) : null,
      category: req.body.category?.trim() || "",
      colors,
      rating: Number(req.body.rating) || 0,
      reviews: Number(req.body.reviews) || 0,
      isNew: req.body.isNew === "true",
      badge: req.body.badge || "",
      images
    });

    const saved = await product.save();
    res.status(201).json(saved);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all
app.get('/api/products', async (_, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  res.json(products);
});

// Get single
app.get('/api/products/:id', async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    p ? res.json(p) : res.status(404).json({ error: "Not found" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update
app.put('/api/products/:id', async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    p ? res.json(p) : res.status(404).json({ error: "Not found" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete
app.delete('/api/products/:id', async (req, res) => {
  try {
    const p = await Product.findByIdAndDelete(req.params.id);
    if (!p) return res.status(404).json({ error: "Not found" });

    p.images.forEach(img => {
      fs.unlink(path.join(uploadDir, img), () => {});
    });

    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Serve uploaded images
app.use('/uploads', express.static(uploadDir));

/* -------------------- HEALTH -------------------- */

app.get('/', (_, res) => {
  res.json({
    message: "Sunglasses API Running",
    time: new Date().toISOString()
  });
});

/* -------------------- SWAGGER -------------------- */

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Sunglasses API",
      version: "1.0.0"
    },
    servers: [
      { url: "https://bbbbb-z4hz.onrender.com" },
      { url: "http://localhost:10000" }
    ]
  },
  apis: [__filename]
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/* -------------------- START SERVER -------------------- */

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server Live → http://localhost:${PORT}`);
});
