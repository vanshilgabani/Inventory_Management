const FactoryReceiving = require('../models/FactoryReceiving');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const mongoose = require('mongoose'); 

// ✅ ADD THIS HELPER AT THE TOP OF EACH CONTROLLER FILE
const decrementEditSession = async (req, action, module, itemId) => {
  // Only decrement for salespeople with active sessions, not admins
  if (req.editSession && !req.isAdmin) {
    try {
      const session = req.editSession;
      session.remainingChanges -= 1;
      session.changesLog.push({
        action, // 'edit' or 'delete'
        module, // 'factory', 'inventory', 'sales', 'directSales'
        itemId: itemId || 'unknown',
        timestamp: new Date()
      });
      if (session.remainingChanges <= 0) {
        session.isActive = false;
      }
      await session.save();
      console.log(`✅ Session decremented: ${session.remainingChanges} changes left for user ${req.user.name}`);
    } catch (error) {
      console.error('Failed to decrement session:', error);
    }
  }
};

// ✅ Simple stock validation (no lock logic)
const validateStockAvailability = async (organizationId, items) => {
  for (const item of items) {
    const product = await Product.findOne({ design: item.design, organizationId });
    if (!product) {
      return {
        error: {
          status: 404,
          body: {
            code: 'PRODUCT_NOT_FOUND',
            message: `Product not found: ${item.design}`,
          },
        },
      };
    }

    // color
    const colorIndex = product.colors.findIndex((c) => c.color === item.color);
    if (colorIndex === -1) {
      return {
        error: {
          status: 404,
          body: {
            code: 'COLOR_NOT_FOUND',
            message: `Color '${item.color}' not found for design '${item.design}'. Please add this color first.`,
          },
        },
      };
    }

    const colorVariant = product.colors[colorIndex];

    // size
    const sizeIndex = colorVariant.sizes.findIndex((s) => s.size === item.size);
    if (sizeIndex === -1) {
      return {
        error: {
          status: 404,
          body: {
            code: 'SIZE_NOT_FOUND',
            message: `Size '${item.size}' not found for ${item.design} - ${item.color}`,
          },
        },
      };
    }

    const currentStock = colorVariant.sizes[sizeIndex].currentStock;
    const requestedQty = item.quantity;

    // Not enough stock → error
    if (currentStock < requestedQty) {
      return {
        error: {
          status: 400,
          body: {
            code: 'INSUFFICIENT_STOCK',
            message: `Insufficient stock for ${item.design} - ${item.color} - ${item.size}. Available: ${currentStock}, Requested: ${requestedQty}`,
            product: {
              design: item.design,
              color: item.color,
              size: item.size,
              available: currentStock,
              requested: requestedQty,
            },
          },
        },
      };
    }
  }

  return { ok: true };
};

// @desc Create factory receiving
// @route POST /api/factory
// @access Private
const createReceiving = async (req, res) => {
  try {
    const {
      design,
      color,
      size,
      quantityReceived,
      quantities,
      batchId,
      notes,
      skipStockUpdate,
      sourceType,
      sourceName,
      returnDueDate,
    } = req.body;

    console.log('Creating factory receiving...');
    let receivingData;
    let quantitiesToUpdate;

    if (size && quantityReceived !== undefined) {
      quantitiesToUpdate = { [size]: quantityReceived };
      receivingData = {
        design,
        color,
        size: size,
        quantities: quantitiesToUpdate,
        totalQuantity: quantityReceived,
        batchId: batchId || '',
        notes: notes || '',
        receivedBy: req.user?.name || 'Admin',
        organizationId: req.organizationId,
        sourceType: sourceType || 'factory',
        sourceName: sourceName || '',
        returnDueDate: returnDueDate || null,
      };
    } else if (quantities) {
      quantitiesToUpdate = quantities;
      const totalQuantity = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
      receivingData = {
        design,
        color,
        size: null,
        quantities,
        totalQuantity,
        batchId: batchId || '',
        notes: notes || '',
        receivedBy: req.user?.name || 'Admin',
        organizationId: req.organizationId,
        sourceType: sourceType || 'factory',
        sourceName: sourceName || '',
        returnDueDate: returnDueDate || null,
      };
    } else {
      return res
        .status(400)
        .json({ message: 'Please provide either size/quantityReceived or quantities object' });
    }

    if (!design || !color) {
      return res.status(400).json({ message: 'Design and color are required' });
    }

    const organizationId = req.organizationId;
    
    // ✅ CORRECTED: Identify stock direction
    const isBorrowed = ['borrowed_buyer', 'borrowed_vendor'].includes(sourceType);
    const isReturn = sourceType === 'return';

    // ✅ CORRECTED: Handle RETURN stock (outgoing - validate and deduct)
    if (isReturn && skipStockUpdate !== true) {
      const itemsForCheck = Object.entries(quantitiesToUpdate || {})
        .filter(([sizeKey, qty]) => qty > 0)
        .map(([sizeKey, qty]) => ({
          design,
          color,
          size: sizeKey,
          quantity: qty,
        }));

      const { error } = await validateStockAvailability(organizationId, itemsForCheck);

      if (error) {
        return res.status(error.status).json(error.body);
      }

      // Deduct stock now
      const product = await Product.findOne({ design, organizationId });
      if (!product) {
        return res.status(404).json({ message: 'Product not found for return' });
      }

      const colorIndex = product.colors.findIndex((c) => c.color === color);
      if (colorIndex === -1) {
        return res.status(404).json({ message: 'Color not found in product for return' });
      }

      Object.keys(quantitiesToUpdate).forEach((sizeKey) => {
        const qty = quantitiesToUpdate[sizeKey];
        if (qty > 0) {
          const sizeIndex = product.colors[colorIndex].sizes.findIndex(
            (s) => s.size === sizeKey
          );
          if (sizeIndex !== -1) {
            const oldStock = product.colors[colorIndex].sizes[sizeIndex].currentStock;
            product.colors[colorIndex].sizes[sizeIndex].currentStock -= qty;
            if (product.colors[colorIndex].sizes[sizeIndex].currentStock < 0) {
              product.colors[colorIndex].sizes[sizeIndex].currentStock = 0;
            }
            console.log(
              `Return ${color} - ${sizeKey}: ${oldStock} → ${product.colors[colorIndex].sizes[sizeIndex].currentStock}`
            );
          }
        }
      });

      await product.save();
      // Create the return receipt and exit
      const receiving = await FactoryReceiving.create(receivingData);
      console.log('Return receipt created successfully');
      return res.status(201).json(receiving);
    }

    // ✅ CORRECTED: Handle BORROWED stock (incoming - ADD to your inventory)
    if (isBorrowed && skipStockUpdate !== true) {
      const product = await Product.findOne({ design, organizationId });
      if (!product) {
        return res.status(404).json({ message: 'Product not found for borrowed stock' });
      }

      const colorIndex = product.colors.findIndex((c) => c.color === color);
      if (colorIndex === -1) {
        return res.status(404).json({ message: 'Color not found in product for borrowed stock' });
      }

      Object.keys(quantitiesToUpdate).forEach((sizeKey) => {
        const qty = quantitiesToUpdate[sizeKey];
        if (qty > 0) {
          const sizeIndex = product.colors[colorIndex].sizes.findIndex(
            (s) => s.size === sizeKey
          );
          if (sizeIndex !== -1) {
            const oldStock = product.colors[colorIndex].sizes[sizeIndex].currentStock;
            // ✅ ADD borrowed stock (incoming from buyer/vendor)
            product.colors[colorIndex].sizes[sizeIndex].currentStock += qty;
            console.log(
              `Borrowed from ${sourceName} - ${color} ${sizeKey}: ${oldStock} → ${product.colors[colorIndex].sizes[sizeIndex].currentStock}`
            );
          }
        }
      });

      await product.save();
      // Create the borrow receipt and exit
      const receiving = await FactoryReceiving.create(receivingData);
      console.log('Borrow receipt created successfully');
      return res.status(201).json(receiving);
    }

    // ✅ Normal factory receiving (incoming stock): add stock
    if (!isBorrowed && !isReturn && skipStockUpdate !== true) {
      const product = await Product.findOne({ design, organizationId });
      if (product) {
        let colorIndex = product.colors.findIndex((c) => c.color === color);
        if (colorIndex === -1) {
          console.log(`Color ${color} not found in design. Adding new color variant...`);
          let settings = await Settings.findOne({ organizationId });
          if (!settings) {
            settings = await Settings.create({
              organizationId,
              enabledSizes: ['S', 'M', 'L', 'XL', 'XXL'],
            });
          }

          const enabledSizes =
            settings.getEnabledSizes?.() || settings.enabledSizes || ['S', 'M', 'L', 'XL', 'XXL'];

          const newColorVariant = {
            color: color,
            wholesalePrice: 0,
            retailPrice: 0,
            sizes: enabledSizes.map((s) => ({
              size: s,
              currentStock: 0,
              reorderPoint: 20,
            })),
          };

          product.colors.push(newColorVariant);
          colorIndex = product.colors.length - 1;
          console.log(`Added new color ${color} to design`);
        }

        console.log('✅ Product found, updating stock (incoming)...');
        Object.keys(quantitiesToUpdate).forEach(sizeKey => {
          const qty = quantitiesToUpdate[sizeKey];
          if (qty > 0) {
            const sizeIndex = product.colors[colorIndex].sizes.findIndex(s => s.size === sizeKey);
            if (sizeIndex !== -1) {
              const oldStock = product.colors[colorIndex].sizes[sizeIndex].currentStock;
              product.colors[colorIndex].sizes[sizeIndex].currentStock += qty;
              console.log(`✅ Updated ${color} - ${sizeKey}: ${oldStock} → ${product.colors[colorIndex].sizes[sizeIndex].currentStock}`);
            } else {
              console.warn(`⚠️ Size ${sizeKey} not found in ${color}`);
            }
          }
        });

        await product.save();
        console.log(`✅ Stock updated for ${design} - ${color}`);
      } else {
        // ✅ Product doesn't exist - CREATE IT
        console.log(`📦 Product '${design}' not found. Creating new design...`);
        
        // Get enabled sizes from settings
        let settings = await Settings.findOne({ organizationId });
        if (!settings) {
          settings = await Settings.create({ organizationId, enabledSizes: ['S', 'M', 'L', 'XL', 'XXL'] });
        }

        const enabledSizes = settings.getEnabledSizes?.() || settings.enabledSizes || ['S', 'M', 'L', 'XL', 'XXL'];

        // Build sizes array with received quantities
        const sizesArray = enabledSizes.map(s => ({
          size: s,
          currentStock: quantitiesToUpdate[s] || 0,
          reorderPoint: 20
        }));

        try {
          // Create new product
          const newProduct = await Product.create({
            design,
            colors: [{
              color,
              wholesalePrice: 0,
              retailPrice: 0,
              sizes: sizesArray
            }],
            organizationId
          });
          console.log(`✅ Created new product '${design}' with color '${color}'`);
          console.log(`✅ Initial stock: ${JSON.stringify(quantitiesToUpdate)}`);
        } catch (error) {
          // Handle duplicate key error (race condition)
          if (error.code === 11000) {
            console.log(`⚠️ Product '${design}' was just created by another request. Adding stock to existing product...`);
            
            // Fetch the newly created product and add stock
            const existingProduct = await Product.findOne({ design, organizationId });
            if (existingProduct) {
              let colorIndex = existingProduct.colors.findIndex((c) => c.color === color);
              if (colorIndex === -1) {
                // Add new color
                const newColorVariant = {
                  color: color,
                  wholesalePrice: 0,
                  retailPrice: 0,
                  sizes: sizesArray
                };
                existingProduct.colors.push(newColorVariant);
              } else {
                // Update existing color stock
                Object.keys(quantitiesToUpdate).forEach(sizeKey => {
                  const qty = quantitiesToUpdate[sizeKey];
                  if (qty > 0) {
                    const sizeIndex = existingProduct.colors[colorIndex].sizes.findIndex(s => s.size === sizeKey);
                    if (sizeIndex !== -1) {
                      existingProduct.colors[colorIndex].sizes[sizeIndex].currentStock += qty;
                    }
                  }
                });
              }
              await existingProduct.save();
              console.log(`✅ Updated existing product '${design}'`);
            }
          } else {
            throw error; // Re-throw if it's not a duplicate error
          }
        }
      }
    }

    const receiving = await FactoryReceiving.create(receivingData);
    console.log(
      'Factory receiving created successfully with organizationId:',
      receiving.organizationId
    );
    res.status(201).json(receiving);
  } catch (error) {
    console.error('Factory Receiving Error:', error);
    res.status(500).json({ message: error.message });
  }
};

const getAllReceivings = async (req, res) => {
  try {
    const receivings = await FactoryReceiving.find({
      organizationId: req.organizationId,
      deletedAt: null, // Only get non-deleted
      sourceType: { $ne: 'supplier-sync' } // ✅ EXCLUDE supplier-synced items
    })
    .sort({ receivedDate: -1 });
    
    res.json(receivings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== GET SINGLE RECEIVING (exclude deleted) =====
const getReceivingById = async (req, res) => {
  try {
    const receiving = await FactoryReceiving.findOne({
      _id: req.params.id,
      deletedAt: null, // ✅ Only get non-deleted
    });
    
    if (!receiving) {
      return res.status(404).json({ message: 'Receiving not found' });
    }
    
    res.json(receiving);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// @desc Update factory receiving
// @route PUT /api/factory/:id
// @access Private
const updateReceiving = async (req, res) => {
  try {
    const { quantities, batchId, notes } = req.body;
    
    const receiving = await FactoryReceiving.findOne({
      _id: req.params.id,
      organizationId: req.organizationId,
      deletedAt: null
    });

    if (!receiving) {
      return res.status(404).json({ message: 'Receiving not found' });
    }

    // ✅ FIXED: Determine stock direction
    const isReturn = receiving.sourceType === 'return';
    const isIncoming = !isReturn; // factory, borrowedbuyer, borrowedvendor (incoming)

    if (isReturn) {
      console.warn('⚠️ Updating return receipt - stock changes will apply');
    }

    console.log(`📝 Updating receiving: ${receiving._id}`);
    console.log(`📦 Design: ${receiving.design}, Color: ${receiving.color}`);

    // Get old quantities
    let oldQuantities = receiving.quantities instanceof Map 
      ? Object.fromEntries(receiving.quantities) 
      : receiving.quantities;

    oldQuantities = Object.keys(oldQuantities).reduce((acc, size) => {
      acc[size] = Number(oldQuantities[size]) || 0;
      return acc;
    }, {});

    // Get new quantities
    const newQuantities = Object.keys(quantities).reduce((acc, size) => {
      acc[size] = Number(quantities[size]) || 0;
      return acc;
    }, {});

    console.log('📊 Old quantities:', oldQuantities);
    console.log('📊 New quantities:', newQuantities);

    // ✅ CRITICAL FIX: Only update stock for THIS receiving's COLOR
    const product = await Product.findOne({
      design: receiving.design,
      organizationId: req.organizationId
    });

    if (product) {
      // ✅ Find ONLY this receiving's color
      const colorIndex = product.colors.findIndex(c => c.color === receiving.color);
      
      if (colorIndex !== -1) {
        // ✅ Only update sizes that changed
        Object.keys(newQuantities).forEach(size => {
          if (size !== 'undefined') {
            const oldQty = oldQuantities[size] || 0;
            const newQty = newQuantities[size] || 0;
            const difference = newQty - oldQty;

            console.log(`📏 Size ${size}: old=${oldQty}, new=${newQty}, diff=${difference}`);

            if (difference !== 0) {
              const sizeIndex = product.colors[colorIndex].sizes.findIndex(
                (s) => s.size === size
              );

              if (sizeIndex !== -1) {
                const oldStock = product.colors[colorIndex].sizes[sizeIndex].currentStock;

                // ✅ CORRECTED: Apply correct operation based on type
                if (isReturn) {
                  // Return (outgoing), so SUBTRACT difference
                  product.colors[colorIndex].sizes[sizeIndex].currentStock -= difference;
                  console.log(`🔻 Return edit: ${size} stock: ${oldStock} - ${difference} = ${product.colors[colorIndex].sizes[sizeIndex].currentStock}`);
                } else {
                  // Factory/Borrowed (incoming), so ADD difference
                  product.colors[colorIndex].sizes[sizeIndex].currentStock += difference;
                  console.log(`🔺 Incoming edit: ${size} stock: ${oldStock} + ${difference} = ${product.colors[colorIndex].sizes[sizeIndex].currentStock}`);
                }

                // Prevent negative stock
                if (product.colors[colorIndex].sizes[sizeIndex].currentStock < 0) {
                  console.log('⚠️ Warning: Stock for size would be negative, setting to 0');
                  product.colors[colorIndex].sizes[sizeIndex].currentStock = 0;
                }

                console.log(
                  `✅ Updated ${receiving.color} ${size}: ${oldStock} → ${product.colors[colorIndex].sizes[sizeIndex].currentStock} (${difference > 0 ? '+' : ''}${difference})`
                );
              } else {
                console.log(`❌ Size ${size} not found in product`);
              }
            }
          }
        });

        await product.save();
        console.log('💾 Product stock updated');
      } else {
        console.log(`❌ Color ${receiving.color} not found in product`);
      }
    } else {
      console.log(`❌ Product ${receiving.design} not found`);
    }

    // Update receiving record
    receiving.quantities = newQuantities;
    receiving.totalQuantity = Object.values(newQuantities).reduce(
      (sum, qty) => sum + qty,
      0
    );

    if (batchId !== undefined) receiving.batchId = batchId;
    if (notes !== undefined) receiving.notes = notes;

    await receiving.save();
    console.log('✅ Receiving updated successfully');

    await decrementEditSession(req, 'edit', 'factory', req.params.id);

    res.json(receiving);
  } catch (error) {
    console.error('❌ Error updating receiving:', error);
    res.status(500).json({ message: error.message });
  }
};

// ===== SOFT DELETE RECEIVING (with transaction) =====
const deleteReceiving = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const receiving = await FactoryReceiving.findOne({
      _id: req.params.id,
      organizationId: req.organizationId,
      deletedAt: null, // ✅ Only delete non-deleted items
    }).session(session);

    if (!receiving) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Receiving record not found or already deleted' });
    }

    // Check borrowed stock status
    if (['borrowedbuyer', 'borrowedvendor'].includes(receiving.sourceType)) {
      if (receiving.borrowStatus === 'active' || receiving.borrowStatus === 'partial') {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: 'Cannot delete borrowed stock that has not been fully returned. Please return the stock first or mark it as returned.',
          code: 'BORROWED_STOCK_ACTIVE',
        });
      }
    }

    console.log('Deleting receiving:', req.params.id);
    console.log('Design:', receiving.design, 'Color:', receiving.color);

    const product = await Product.findOne({
      design: receiving.design,
      organizationId: req.organizationId,
    }).session(session);

    if (!product) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Product not found' });
    }

    const colorIndex = product.colors.findIndex((c) => c.color === receiving.color);
    if (colorIndex === -1) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Color not found in product' });
    }

    // Determine stock direction
    const isReturn = receiving.sourceType === 'return';
    const isIncoming = !isReturn;

    if (isIncoming) {
      // Original was incoming (added stock), so now SUBTRACT
      const quantities =
        receiving.quantities instanceof Map
          ? Object.fromEntries(receiving.quantities)
          : receiving.quantities;

      console.log('Quantities to remove:', quantities);

      Object.keys(quantities).forEach((size) => {
        if (size !== undefined) {
          const sizeIndex = product.colors[colorIndex].sizes.findIndex(
            (s) => s.size === size
          );
          if (sizeIndex !== -1) {
            const oldStock = product.colors[colorIndex].sizes[sizeIndex].currentStock;
            product.colors[colorIndex].sizes[sizeIndex].currentStock -= quantities[size];

            if (product.colors[colorIndex].sizes[sizeIndex].currentStock < 0) {
              product.colors[colorIndex].sizes[sizeIndex].currentStock = 0;
            }

            console.log(
              `Reduced stock for ${size}: ${oldStock} → ${product.colors[colorIndex].sizes[sizeIndex].currentStock}`
            );
          }
        }
      });

      await product.save({ session });
    } else {
      // Original was return (subtracted stock), so now ADD back
      const quantities =
        receiving.quantities instanceof Map
          ? Object.fromEntries(receiving.quantities)
          : receiving.quantities;

      console.log('Adding stock back from deleted return:', quantities);

      Object.keys(quantities).forEach((size) => {
        if (size !== undefined) {
          const sizeIndex = product.colors[colorIndex].sizes.findIndex(
            (s) => s.size === size
          );
          if (sizeIndex !== -1) {
            const oldStock = product.colors[colorIndex].sizes[sizeIndex].currentStock;
            product.colors[colorIndex].sizes[sizeIndex].currentStock += quantities[size];
            console.log(
              `Added back stock for ${size}: ${oldStock} → ${product.colors[colorIndex].sizes[sizeIndex].currentStock}`
            );
          }
        }
      });

      await product.save({ session });
    }

    // ✅ SOFT DELETE instead of hard delete
    receiving.deletedAt = new Date();
    receiving.deletedBy = req.user?.id || req.user?._id;
    receiving.deletionReason = 'User deleted';
    await receiving.save({ session });

    console.log('✅ Receiving soft deleted successfully');

    await decrementEditSession(req, 'delete', 'factory', req.params.id);

    await session.commitTransaction();
    session.endSession();

    res.json({ message: 'Receiving deleted and stock updated' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Delete Receiving Error:', error);
    res.status(500).json({ message: error.message });
  }
}

// ===== ✅ NEW: RESTORE DELETED RECEIVING =====
const restoreReceiving = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const receiving = await FactoryReceiving.findOne({
      _id: req.params.id,
      organizationId: req.organizationId,
      deletedAt: { $ne: null }, // ✅ Only restore deleted items
    }).session(session);

    if (!receiving) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Deleted receiving not found' });
    }

    console.log('Restoring receiving:', req.params.id);
    console.log('Design:', receiving.design, 'Color:', receiving.color);

    const product = await Product.findOne({
      design: receiving.design,
      organizationId: req.organizationId,
    }).session(session);

    if (!product) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Product not found' });
    }

    const colorIndex = product.colors.findIndex((c) => c.color === receiving.color);
    if (colorIndex === -1) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Color not found in product' });
    }

    // Reverse the deletion - add stock back
    const isReturn = receiving.sourceType === 'return';
    const isIncoming = !isReturn;

    const quantities =
      receiving.quantities instanceof Map
        ? Object.fromEntries(receiving.quantities)
        : receiving.quantities;

    if (isIncoming) {
      // Was incoming, so ADD stock back
      Object.keys(quantities).forEach((size) => {
        if (size !== undefined) {
          const sizeIndex = product.colors[colorIndex].sizes.findIndex(
            (s) => s.size === size
          );
          if (sizeIndex !== -1) {
            const oldStock = product.colors[colorIndex].sizes[sizeIndex].currentStock;
            product.colors[colorIndex].sizes[sizeIndex].currentStock += quantities[size];
            console.log(
              `Restored stock for ${size}: ${oldStock} → ${product.colors[colorIndex].sizes[sizeIndex].currentStock}`
            );
          }
        }
      });
    } else {
      // Was return, so SUBTRACT stock
      Object.keys(quantities).forEach((size) => {
        if (size !== undefined) {
          const sizeIndex = product.colors[colorIndex].sizes.findIndex(
            (s) => s.size === size
          );
          if (sizeIndex !== -1) {
            const oldStock = product.colors[colorIndex].sizes[sizeIndex].currentStock;
            product.colors[colorIndex].sizes[sizeIndex].currentStock -= quantities[size];
            
            if (product.colors[colorIndex].sizes[sizeIndex].currentStock < 0) {
              product.colors[colorIndex].sizes[sizeIndex].currentStock = 0;
            }
            
            console.log(
              `Restored return: ${size}: ${oldStock} → ${product.colors[colorIndex].sizes[sizeIndex].currentStock}`
            );
          }
        }
      });
    }

    await product.save({ session });

    // Restore the record
    receiving.deletedAt = null;
    receiving.deletedBy = null;
    receiving.deletionReason = '';
    await receiving.save({ session });

    console.log('✅ Receiving restored successfully');

    await session.commitTransaction();
    session.endSession();

    res.json({ message: 'Receiving restored successfully', receiving });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Restore Receiving Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ===== ✅ NEW: GET ALL DELETED RECEIVINGS =====
const getDeletedReceivings = async (req, res) => {
  try {
    const deletedReceivings = await FactoryReceiving.find({
      organizationId: req.organizationId,
      deletedAt: { $ne: null }, // ✅ Only get deleted items
    })
      .sort({ deletedAt: -1 })
      .populate('deletedBy', 'name email')
      .lean();

    res.json(deletedReceivings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== ✅ NEW: PERMANENTLY DELETE =====
const permanentlyDeleteReceiving = async (req, res) => {
  try {
    const receiving = await FactoryReceiving.findOne({
      _id: req.params.id,
      organizationId: req.organizationId,
      deletedAt: { $ne: null }, // ✅ Only permanently delete already soft-deleted items
    });

    if (!receiving) {
      return res.status(404).json({ message: 'Deleted receiving not found' });
    }

    await FactoryReceiving.findByIdAndDelete(req.params.id);
    
    console.log('✅ Receiving permanently deleted:', req.params.id);

    res.json({ message: 'Receiving permanently deleted' });
  } catch (error) {
    console.error('Permanent Delete Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Return borrowed stock (same or exchange)
// @route POST /api/factory/:id/return
// @access Private
const returnBorrowedStock = async (req, res) => {
  try {
    const {
      returnType,
      quantitiesToReturn,
      exchangeItems,
      returnNotes,
      settlementInfo,
    } = req.body;

    const borrowReceiptId = req.params.id;

    console.log('🔍 Return Request:', {
      returnType,
      borrowReceiptId,
      quantitiesToReturn,
      exchangeItems,
      settlementInfo,
    });

    // Validate return type
    if (!['same', 'exchange'].includes(returnType)) {
      return res
        .status(400)
        .json({ message: 'Invalid return type. Must be "same" or "exchange"' });
    }

    // Get borrow receipt
    const borrowReceipt = await FactoryReceiving.findOne({
      _id: borrowReceiptId,
      organizationId: req.organizationId,
    });

    if (!borrowReceipt) {
      return res.status(404).json({ message: 'Borrow receipt not found' });
    }

    if (!['borrowed_buyer', 'borrowed_vendor'].includes(borrowReceipt.sourceType)) {
      return res.status(400).json({ message: 'This receipt is not a borrowed stock' });
    }

    const originalTotal = borrowReceipt.totalQuantity || 0;
    const alreadyReturned = borrowReceipt.returnedQuantity || 0;
    const remaining = originalTotal - alreadyReturned;
    let totalReturning = 0;

    // ===== HANDLE "SAME" RETURN =====
    if (returnType === 'same') {
      if (!quantitiesToReturn) {
        return res
          .status(400)
          .json({ message: 'quantitiesToReturn is required for same return type' });
      }

      totalReturning = Object.values(quantitiesToReturn).reduce(
        (sum, qty) => sum + (Number(qty) || 0),
        0
      );

      if (totalReturning > remaining) {
        return res.status(400).json({
          message: `Cannot return ${totalReturning} units. Only ${remaining} units remaining.`,
        });
      }

      // ✅ Validate stock for SAME return (outgoing)
      const itemsForCheck = Object.entries(quantitiesToReturn).map(([size, qty]) => ({
        design: borrowReceipt.design,
        color: borrowReceipt.color,
        size: size,
        quantity: qty,
      }));

      const { error } = await validateStockAvailability(req.organizationId, itemsForCheck);

      if (error) {
        return res.status(error.status).json(error.body);
      }

      // Find product to reduce stock (returning = outgoing from you)
      const product = await Product.findOne({
        design: borrowReceipt.design,
        organizationId: req.organizationId,
      });

      if (!product) {
        return res
          .status(404)
          .json({ message: `Product ${borrowReceipt.design} not found` });
      }

      // ✅ CORRECTED: Reduce stock (returning same = outgoing)
      const colorIndex = product.colors.findIndex((c) => c.color === borrowReceipt.color);
      if (colorIndex !== -1) {
        Object.keys(quantitiesToReturn).forEach((size) => {
          const qty = quantitiesToReturn[size];
          if (qty > 0) {
            const sizeIndex = product.colors[colorIndex].sizes.findIndex(
              (s) => s.size === size
            );
            if (sizeIndex !== -1) {
              const oldStock = product.colors[colorIndex].sizes[sizeIndex].currentStock;
              // ✅ SUBTRACT for return (outgoing)
              product.colors[colorIndex].sizes[sizeIndex].currentStock -= qty;
              if (product.colors[colorIndex].sizes[sizeIndex].currentStock < 0) {
                product.colors[colorIndex].sizes[sizeIndex].currentStock = 0;
              }
              console.log(
                `Return same: ${borrowReceipt.color} ${size}: ${oldStock} → ${product.colors[colorIndex].sizes[sizeIndex].currentStock} (-${qty})`
              );
            }
          }
        });
        await product.save();
      }

      // Create return receipt
      const returnReceipt = await FactoryReceiving.create({
        design: borrowReceipt.design,
        color: borrowReceipt.color,
        quantities: quantitiesToReturn,
        totalQuantity: totalReturning,
        batchId: borrowReceipt.batchId,
        notes: `RETURN to ${borrowReceipt.sourceName}${
          returnNotes ? ' - ' + returnNotes : ''
        }`,
        sourceType: 'return',
        sourceName: borrowReceipt.sourceName,
        receivedBy: req.user?.name || 'Admin',
        organizationId: req.organizationId,
        originalBorrowId: borrowReceipt._id,
        returnType: 'same',
      });

      // Update borrow receipt
      const newReturnedQuantities =
        borrowReceipt.returnedQuantities instanceof Map
          ? Object.fromEntries(borrowReceipt.returnedQuantities)
          : borrowReceipt.returnedQuantities || {};

      Object.keys(quantitiesToReturn).forEach((size) => {
        newReturnedQuantities[size] =
          (newReturnedQuantities[size] || 0) + quantitiesToReturn[size];
      });

      borrowReceipt.returnedQuantity = alreadyReturned + totalReturning;
      borrowReceipt.returnedQuantities = newReturnedQuantities;
      borrowReceipt.returnReceiptId = returnReceipt._id;

      if (borrowReceipt.returnedQuantity >= originalTotal) {
        borrowReceipt.borrowStatus = 'returned';
        borrowReceipt.returnedDate = new Date();
      } else {
        borrowReceipt.borrowStatus = 'partial';
      }

      await borrowReceipt.save();

      console.log(`✅ Returned ${totalReturning} units to ${borrowReceipt.sourceName}`);

      return res.status(201).json({
        message: `Successfully returned ${totalReturning} units to ${borrowReceipt.sourceName}`,
        returnReceipt,
        borrowReceipt,
      });
    }

    // ===== HANDLE "EXCHANGE" RETURN =====
    if (returnType === 'exchange') {
      if (!exchangeItems || !Array.isArray(exchangeItems) || exchangeItems.length === 0) {
        return res.status(400).json({
          message: 'exchangeItems array is required for exchange return type',
        });
      }

      console.log('📦 Processing exchange items:', exchangeItems);

      // ✅ Validate stock for exchange items
      const itemsForCheck = [];
      for (const exchItem of exchangeItems) {
        Object.entries(exchItem.quantities || {}).forEach(([size, qty]) => {
          const numQty = Number(qty) || 0;
          if (numQty > 0) {
            itemsForCheck.push({
              design: exchItem.design,
              color: exchItem.color,
              size,
              quantity: numQty,
            });
          }
        });
      }

      const { error } = await validateStockAvailability(req.organizationId, itemsForCheck);

      if (error) {
        return res.status(error.status).json(error.body);
      }

      // ✅ Calculate borrowed stock value (if not already stored)
      if (!borrowReceipt.totalBorrowedValue) {
        const borrowProduct = await Product.findOne({
          design: borrowReceipt.design,
          organizationId: req.organizationId,
        });
        if (borrowProduct) {
          const borrowColor = borrowProduct.colors.find(
            (c) => c.color === borrowReceipt.color
          );
          const borrowWholesalePrice = borrowColor?.wholesalePrice || 0;
          borrowReceipt.totalBorrowedValue = originalTotal * borrowWholesalePrice;
        }
      }

      // Process each exchange item
      const returnReceipts = [];
      let totalExchangeValue = 0;

      for (const exchItem of exchangeItems) {
        if (!exchItem.design || !exchItem.color || !exchItem.quantities) {
          return res.status(400).json({
            message: 'Each exchange item must include design, color, and quantities',
          });
        }

        const itemQty = Object.values(exchItem.quantities).reduce(
          (sum, qty) => sum + (Number(qty) || 0),
          0
        );

        if (itemQty === 0) continue;

        totalReturning += itemQty;

        // Find and validate product
        const product = await Product.findOne({
          design: exchItem.design,
          organizationId: req.organizationId,
        });

        if (!product) {
          return res
            .status(404)
            .json({ message: `Exchange product ${exchItem.design} not found` });
        }

        const colorIndex = product.colors.findIndex(
          (c) => c.color === exchItem.color
        );

        if (colorIndex === -1) {
          return res.status(404).json({
            message: `Color ${exchItem.color} not found in ${exchItem.design}`,
          });
        }

        // Calculate exchange value
        const exchangeWholesalePrice =
          product.colors[colorIndex].wholesalePrice || 0;
        const itemValue = itemQty * exchangeWholesalePrice;
        totalExchangeValue += itemValue;

        // Deduct stock
        for (const [size, qty] of Object.entries(exchItem.quantities)) {
          const numQty = Number(qty) || 0;
          if (numQty > 0) {
            const sizeIndex = product.colors[colorIndex].sizes.findIndex(
              (s) => s.size === size
            );

            if (sizeIndex === -1) {
              return res.status(404).json({
                message: `Size ${size} not found in ${exchItem.design}-${exchItem.color}`,
              });
            }

            const oldStock = product.colors[colorIndex].sizes[sizeIndex].currentStock;
            product.colors[colorIndex].sizes[sizeIndex].currentStock -= numQty;
            if (product.colors[colorIndex].sizes[sizeIndex].currentStock < 0) {
              product.colors[colorIndex].sizes[sizeIndex].currentStock = 0;
            }
            console.log(
              `Exchange: ${exchItem.design} ${exchItem.color} ${size}: ${oldStock} → ${product.colors[colorIndex].sizes[sizeIndex].currentStock} (-${numQty})`
            );
          }
        }
        await product.save();

        // Create return receipt
        const settlementNote = settlementInfo
          ? settlementInfo.settlementType === 'balanced'
            ? ' [BALANCED]'
            : settlementInfo.settlementType === 'excess'
            ? ` [EXCESS: ₹${Math.abs(settlementInfo.difference)}]`
            : ` [DEFICIT: ₹${Math.abs(settlementInfo.difference)}]`
          : '';

        const returnReceipt = await FactoryReceiving.create({
          design: exchItem.design,
          color: exchItem.color,
          quantities: exchItem.quantities,
          totalQuantity: itemQty,
          batchId: borrowReceipt.batchId,
          notes: `RETURN (EXCHANGE) to ${borrowReceipt.sourceName} | Original: ${borrowReceipt.design}-${borrowReceipt.color}${settlementNote}${
            returnNotes ? ' | ' + returnNotes : ''
          }`,
          sourceType: 'return',
          sourceName: borrowReceipt.sourceName,
          receivedBy: req.user?.name || 'Admin',
          organizationId: req.organizationId,
          originalBorrowId: borrowReceipt._id,
          returnType: 'exchange',
          exchangeInfo: {
            originalDesign: borrowReceipt.design,
            originalColor: borrowReceipt.color,
            exchangeValue: itemValue,
            settlementInfo: settlementInfo,
          },
        });

        returnReceipts.push(returnReceipt);
      }

      // ✅ UPDATE: Track returned value
      borrowReceipt.returnedValue =
        (borrowReceipt.returnedValue || 0) + totalExchangeValue;
      borrowReceipt.exchangeSettlement = settlementInfo;
      borrowReceipt.returnReceiptId = returnReceipts[0]?._id;

      // ✅ Calculate equivalent quantity based on value percentage
      const borrowedValue = borrowReceipt.totalBorrowedValue || 1;
      const returnedPercentage =
        (borrowReceipt.returnedValue / borrowedValue) * 100;
      const equivalentQty = Math.floor(
        (borrowReceipt.returnedValue / borrowedValue) * originalTotal
      );

      borrowReceipt.returnedQuantity = equivalentQty;

      // Update status
      if (returnedPercentage >= 100) {
        borrowReceipt.borrowStatus = 'returned';
        borrowReceipt.returnedDate = new Date();
      } else if (returnedPercentage > 0) {
        borrowReceipt.borrowStatus = 'partial';
      }

      await borrowReceipt.save();

      console.log(
        `✅ Exchanged ${totalReturning} units (₹${totalExchangeValue}) with ${borrowReceipt.sourceName}`
      );
      console.log(
        `✅ Returned value: ₹${borrowReceipt.returnedValue} / ₹${borrowedValue} (${returnedPercentage.toFixed(
          2
        )}%)`
      );

      return res.status(201).json({
        message: `Successfully processed exchange with ${borrowReceipt.sourceName}`,
        returnReceipts,
        borrowReceipt,
        settlement: {
          ...settlementInfo,
          totalExchangeValue,
          returnedValue: borrowReceipt.returnedValue,
          borrowedValue,
          returnedPercentage: returnedPercentage.toFixed(2),
          equivalentQtyReturned: equivalentQty,
        },
      });
    }
  } catch (error) {
    console.error('❌ Return Stock Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Mark payment as done for borrowed stock
// @route POST /api/factory/:id/mark-payment
// @access Private
const markPaymentDone = async (req, res) => {
  try {
    const { paymentAmount, paymentNotes } = req.body;
    const borrowReceiptId = req.params.id;

    const borrowReceipt = await FactoryReceiving.findOne({
      _id: borrowReceiptId,
      organizationId: req.organizationId,
    });

    if (!borrowReceipt) {
      return res.status(404).json({ message: 'Borrow receipt not found' });
    }

    if (!['borrowed_buyer', 'borrowed_vendor'].includes(borrowReceipt.sourceType)) {
      return res.status(400).json({ message: 'This receipt is not a borrowed stock' });
    }

    borrowReceipt.paymentStatus = 'completed';
    borrowReceipt.paymentAmount = paymentAmount || 0;
    borrowReceipt.paymentNotes = paymentNotes || '';
    borrowReceipt.paymentDate = new Date();
    borrowReceipt.borrowStatus = 'returned'; // Mark as fully settled

    await borrowReceipt.save();

    console.log(`✅ Payment marked as done for ${borrowReceipt.sourceName}`);

    res.json({
      message: `Payment marked as completed for ${borrowReceipt.sourceName}`,
      borrowReceipt,
    });
  } catch (error) {
    console.error('Mark Payment Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Get borrow + return history for a source (party)
// @route GET /api/factory/borrow-history/:sourceName
// @access Private
const getBorrowHistoryBySource = async (req, res) => {
  try {
    const { sourceName } = req.params;
    const organizationId = req.organizationId;

    if (!sourceName || !sourceName.trim()) {
      return res.status(400).json({ message: 'sourceName is required' });
    }

    // All borrow receipts for this party
    const borrows = await FactoryReceiving.find({
      organizationId,
      sourceName,
      sourceType: { $in: ['borrowed_buyer', 'borrowed_vendor'] },
    })
      .sort({ receivedDate: -1 })
      .lean();

    if (!borrows.length) {
      return res.json({ borrows: [], returns: [] });
    }

    const borrowIds = borrows.map((b) => b._id);

    // All returns linked to any of these borrows
    const returns = await FactoryReceiving.find({
      organizationId,
      originalBorrowId: { $in: borrowIds },
      sourceType: 'return',
    })
      .sort({ receivedDate: 1 })
      .lean();

    res.json({ borrows, returns });
  } catch (error) {
    console.error('Borrow history error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllReceivings,
  createReceiving,
  getReceivingById,
  updateReceiving,
  deleteReceiving,
  returnBorrowedStock,
  markPaymentDone,
  getBorrowHistoryBySource,
  restoreReceiving,
  getDeletedReceivings,
  permanentlyDeleteReceiving,
};
