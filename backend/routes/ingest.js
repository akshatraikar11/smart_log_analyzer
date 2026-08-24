/**
 * Dataset ingestion routes (thin layer).
 */

const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const ingestController = require('../controllers/ingestController');

router.post('/', asyncHandler(ingestController.ingestDataset));

module.exports = router;
