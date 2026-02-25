// File purpose: Application logic for this Netflix Clone module.
const express = require('express');
const {
  getMovies,
  getMovieById,
  getTmdbTrailer,
  createMovie,
  updateMovie,
  deleteMovie,
} = require('../controllers/movieController');

const router = express.Router();

router.get('/', getMovies);
router.get('/tmdb-trailer/:type/:id', getTmdbTrailer);
router.get('/:id', getMovieById);
router.post('/', createMovie);
router.put('/:id', updateMovie);
router.delete('/:id', deleteMovie);

module.exports = router;
