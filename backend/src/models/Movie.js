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
    synopsis: {
      type: String,
      default: '',
    },
    cast: {
      type: [String],
      default: [],
    },
    crew: {
      type: [String],
      default: [],
    },
    genres: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    maturityRating: {
      type: String,
      default: '',
    },
    releaseDate: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: null,
    },
    languages: {
      type: [String],
      default: [],
    },
    thumbnailUrl: {
      type: String,
      default: '',
    },
    posterUrl: {
      type: String,
      default: '',
    },
    trailerFileUrl: {
      type: String,
      default: '',
    },
    seasons: {
      type: [
        {
          seasonNumber: { type: Number, required: true },
          title: { type: String, default: '' },
          episodes: {
            type: [
              {
                episodeNumber: { type: Number, required: true },
                title: { type: String, required: true, trim: true },
                description: { type: String, default: '' },
                airDate: { type: Date, default: null },
                durationMinutes: { type: Number, default: null },
                videoUrl: { type: String, default: '' },
              },
            ],
            default: [],
          },
        },
      ],
      default: [],
    },
    collections: {
      type: [String],
      default: [],
    },
    categoryOverrides: {
      type: [String],
      default: [],
    },
    featuredRank: {
      type: Number,
      default: null,
    },
    videoAssets: {
      sourceUrl: { type: String, default: '' },
      formats: { type: [String], default: [] },
      qualityVariants: { type: [String], default: [] },
      subtitles: { type: [String], default: [] },
      audioTracks: { type: [String], default: [] },
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
