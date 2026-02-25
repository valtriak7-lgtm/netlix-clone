// File purpose: Application logic for this Netflix Clone module.
const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['movie', 'series'],
      default: 'movie',
      required: true,
    },
    year: {
      type: Number,
      required: true,
      min: 1900,
      max: 2100,
    },
    rating: {
      type: String,
      required: true,
      default: 'U/A 13+',
    },
    duration: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    backdropUrl: {
      type: String,
      required: true,
    },
    trailerUrl: {
      type: String,
      required: true,
    },
    featured: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

movieSchema.index({ title: 'text', description: 'text', category: 'text' });

module.exports = mongoose.model('Movie', movieSchema);
