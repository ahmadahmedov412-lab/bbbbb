// index.js - FULL FINAL VERSION - WORKS ON RENDER + LOCALHOST

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

// CORS CONFIGURATION - THIS IS THE REAL FIX
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "https://mihlievs.uz",
    "https://your-frontend-domain.com" // change later
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "Cache-Control"
  ],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Extra safety: handle all preflight requests
app.options('*', cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create uploads folder
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const isValid = allowed.test(file.mimetype) && allowed.test(path.extname(file.originalname).toLowerCase());
    if (isValid) return cb(null, true);
    cb(new Error('Only JPEG, JPG, PNG and WebP images are allowed'));
  }
});

// Product Schema
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
  images: [{ type: String }], // only filenames
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://Abdulloh:634571@cluster0.76u0c.mongodb.net/sunglasses?retryWrites=true&w=majority")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => {
    console.error("MongoDB Error:", err);
    process.exit(1);
  });

// ROUTES

// Create Product with Images
app.post('/api/products', upload.array('images', 10), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length < 2) {
      return res.status(400).json({ error: 'Minimum 2+ images required' });
    }

    const images = files.map(file => file.filename);

    const colors = typeof req.body.colors === 'string' 
      ? JSON.parse(req.body.colors) 
      : req.body.colors || [];

    const product = new Product({
      name: req.body.name,
      .trim(),
      variant: req.body.variant    .trim(),
      price: Number(req.body.price),
      originalPrice: req.body.originalPrice ? Number(req.body.originalPrice) : undefined,
      category: req.body.category  .trim(),
      colors,
      rating: Number(req.body.rating) || 0,
      reviews: Number(req.body.reviews) || 0,
      isNew: req.body.isNew === 'true',
      badge: req.body.badge || undefined,
      images
    });

    const saved = await product.save();
    res.status(201).json(saved);

  } catch (error) {
    console.error('Create product error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Get All Products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Single Product
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Product
app.put('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });
    // Optional: delete images from disk
    product.images.forEach(img => {
      fs.unlink(path.join(uploadDir, img), err => {
        if (err) console.log("Failed to delete image:", img);
      });
    });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve uploaded images
app.use('/uploads', express.static(uploadDir));

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: "Sunglasses API Running!", 
    time: new Date().toISOString(),
    url: "https://bbbbb-z4hz.onrender.com"
  });
});

// Swagger Docs (optional)
const swaggerSpec = swaggerJsdoc({
  swaggerDefinition: {
    openapi: '3.0.0',
    info: { title: 'Sunglasses API', version: '1.0.0' },
    servers: [{ url: 'https://bbbbb-z4hz.onrender.com' }]
  },
  apis: [__filename]
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Start Server
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server LIVE at https://bbbbb-z4hz.onrender.com`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Swagger: https://bbbbb-z4hz.onrender.com/api-docs`);
});
