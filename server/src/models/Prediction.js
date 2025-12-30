const mongoose = require('mongoose');

const variantPredictionSchema = new mongoose.Schema({
  design: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    required: true,
  },
  predictedSales: {
    type: Number,
    required: true,
  },
  actualSales: {
    type: Number,
    default: null,
  },
  accuracy: {
    type: Number,
    default: null,
  },
});

const predictionSchema = new mongoose.Schema({
  predictionDate: {
    type: Date,
    required: true,
  },
  predictions: [variantPredictionSchema],
  overallAccuracy: {
    type: Number,
    default: null,
  },
  modelVersion: {
    type: String,
    default: 'v1.0',
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Prediction', predictionSchema);
