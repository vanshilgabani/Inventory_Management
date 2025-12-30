const express = require('express');
const router = express.Router();
const {
  getChallanSettings,
  updateChallanSettings
} = require('../controllers/challanSettingsController');
const { protect } = require('../middleware/auth');

router.route('/')
  .get(protect, getChallanSettings)
  .put(protect, updateChallanSettings);

module.exports = router;
