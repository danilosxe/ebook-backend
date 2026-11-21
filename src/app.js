const express = require('express');
const cors = require('cors');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

// Permite que seu site (front-end) chame esta API
app.use(cors({
  origin: process.env.FRONTEND_URL || '*'
}));

app.use(express.json());

// Rota de saúde para verificar se o servidor está online
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/payments', paymentRoutes);

module.exports = app;