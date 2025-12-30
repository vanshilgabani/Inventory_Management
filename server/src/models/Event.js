const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  eventName: {
    type: String,
    required: [true, 'Event name is required'],
    trim: true,
  },
  eventDate: {
    type: Date,
    required: [true, 'Event date is required'],
  },
  impactLevel: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium',
  },
  eventType: {
    type: String,
    enum: ['Festival', 'Sale', 'Holiday', 'Seasonal', 'Other'],
    required: [true, 'Event type is required'],
  },
  description: {
    type: String,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Event', eventSchema);
