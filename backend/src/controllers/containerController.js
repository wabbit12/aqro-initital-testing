const mongoose = require('mongoose');
const Container = require('../models/Container');
const ContainerType = require('../models/ContainerType');
const Rebate = require('../models/Rebate');
const Activity = require('../models/Activity');
const QRCode = require('qrcode');
const Restaurant = require('../models/Restaurant');
const RestaurantContainerRebate = require('../models/RestaurantContainerRebate');

// Generate QR code image
// Get container stats for a restaurant
exports.getRestaurantContainerStats = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    // First check if the staff user belongs to this restaurant
    if (req.user.userType === 'staff' && req.user.restaurantId.toString() !== restaurantId) {
      return res.status(403).json({ message: 'Unauthorized access to restaurant data' });
    }
    
    // Get available containers count
    const availableContainers = await Container.countDocuments({
      restaurantId,
      status: 'available'
    });

    // Get active containers count
    const activeContainers = await Container.countDocuments({
      restaurantId,
      status: 'active'
    });

    // Get returned containers count
    const returnedContainers = await Container.countDocuments({
      restaurantId,
      status: 'returned'
    });

    res.json({
      availableContainers,
      activeContainers,
      returnedContainers
    });
  } catch (error) {
    console.error('Error getting restaurant container stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getQRCodeImage = async (req, res) => {
  try {
    const { id } = req.params;
    const container = await Container.findById(id);
    
    if (!container) {
        return res.status(404).json({ message: 'Container not found' });
    }

    // Generate QR code as PNG buffer instead of data URL
    const qrCodeBuffer = await QRCode.toBuffer(container.qrCode);
    
    // Set appropriate headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');  // Add this line
    
    // Send image buffer directly
    res.send(qrCodeBuffer);
} catch (error) {
    console.error('Error generating QR code image:', error);
    res.status(500).json({ message: 'Server error' });
}
};

// Get container details by QR code
exports.getContainerDetailsByQR = async (req, res) => {
  try {
    const { qrCode } = req.query;
    
    if (!qrCode) {
      return res.status(400).json({ message: 'QR code is required' });
    }
    
    const container = await Container.findOne({ qrCode })
      .populate('containerTypeId')
      .populate('customerId', 'firstName lastName email')
      .populate('restaurantId', 'name location');
    
    if (!container) {
      return res.status(404).json({ message: 'Container not found' });
    }
    
    res.json(container);
  } catch (error) {
    console.error('Error getting container details by QR:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get container stats for a customer
exports.getContainerStats = async (req, res) => {
  try {
    const customerId = req.user._id;

    // Get active containers count
    const activeContainers = await Container.countDocuments({
      customerId,
      status: 'active'
    });

    // Get returned containers count
    const returnedContainers = await Container.countDocuments({
      customerId,
      status: 'returned'
    });

    // Get total rebate amount
    const rebates = await Rebate.find({ customerId });
    const totalRebate = rebates.reduce((total, rebate) => total + rebate.amount, 0);

    res.json({
      activeContainers,
      returnedContainers,
      totalRebate
    });
  } catch (error) {
    console.error('Error getting container stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all containers for a customer
exports.getCustomerContainers = async (req, res) => {
  try {
    const customerId = req.user._id;
    
    const containers = await Container.find({ customerId })
      .populate('containerTypeId')
      .populate('restaurantId', 'name location')
      .sort({ updatedAt: -1 });
    
    res.json(containers);
  } catch (error) {
    console.error('Error getting customer containers:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Register a container to a customer
exports.registerContainer = async (req, res) => {
  try {
    const { qrCode } = req.body;
    const customerId = req.user._id;
    
    // Check if container exists
    const container = await Container.findOne({ qrCode })
      .populate('containerTypeId');
    
    if (!container) {
      return res.status(404).json({ message: 'Container not found' });
    }
    
    // Check if container is already registered to the current user
    if (container.customerId && container.customerId.toString() === customerId.toString()) {
      return res.status(200).json({ 
        success: true,
        message: 'Container is already registered to your account',
        alreadyRegistered: true,
        ownedByCurrentUser: true,
        container
      });
    }
    
    // Check if container is already registered to another user
    if (container.customerId && container.customerId.toString() !== customerId.toString()) {
      return res.status(200).json({ 
        success: true,
        message: 'Container is already registered to another user',
        alreadyRegistered: true,
        ownedByCurrentUser: false
      });
    }
    
    // Only update and save the container if not already registered
    container.customerId = customerId;
    container.status = 'active';
    container.registrationDate = new Date();
    
    await container.save();

    const newActivity = new Activity({
      userId: customerId,
      containerId: container._id,
      containerTypeId: container.containerTypeId,
      restaurantId: container.restaurantId,
      type: 'registration',
      notes: 'Container registered'
    });
    
    await newActivity.save();
    
    return res.status(200).json({
      success: true,
      message: 'Container registered successfully',
      alreadyRegistered: false,
      container
    });
  } catch (error) {
    console.error('Error registering container:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// Process rebate
exports.processRebate = async (req, res) => {
  try {
    const { containerId } = req.body;
    const staffId = req.user._id;
    
    // Find the container with full population
    const container = await Container.findById(containerId)
      .populate('containerTypeId')
      .populate('customerId');
    
    if (!container) {
      return res.status(404).json({ message: 'Container not found' });
    }
    
    if (!container.customerId) {
      return res.status(400).json({ message: 'Container is not registered to any customer' });
    }
    
    // Check if container has reached its maximum uses
    if (container.containerTypeId.maxUses <= container.usesCount) {
      return res.status(400).json({ 
        message: 'Container has reached its maximum number of uses',
        maxUses: container.containerTypeId.maxUses,
        currentUses: container.usesCount
      });
    }
    
    // Get staff restaurant information
    const staffUser = await mongoose.model('User').findById(staffId)
      .populate('restaurantId');
    
    if (!staffUser || !staffUser.restaurantId) {
      return res.status(400).json({ message: 'Staff user is not associated with a restaurant' });
    }
    
    const restaurant = staffUser.restaurantId;

    // Find restaurant-specific rebate mapping
    const rebateMapping = await RestaurantContainerRebate.findOne({
      restaurantId: restaurant._id,
      containerTypeId: container.containerTypeId._id
    });

    if (!rebateMapping) {
      return res.status(404).json({ 
        message: 'No rebate value found for this container type and restaurant' 
      });
    }

    // Use the restaurant-specific rebate value
    const amount = rebateMapping.rebateValue;
    const customerId = container.customerId._id;
    const location = restaurant.name;
    
    // Create rebate record
    const rebate = new Rebate({
      containerId,
      customerId,
      staffId,
      amount,
      location
    });
    
    await rebate.save();
    
    // Update container status
    container.lastUsed = new Date();
    container.usesCount = (container.usesCount || 0) + 1;
    
    await container.save();
    
    // Record activity
    const newActivity = new Activity({
      userId: customerId,
      containerId,
      containerTypeId: container.containerTypeId._id,
      restaurantId: restaurant._id,
      type: 'rebate',
      amount,
      location,
      notes: 'Rebate processed'
    });
    
    await newActivity.save();

    res.status(201).json({
      success: true,
      message: 'Rebate processed successfully',
      amount,
      rebate
    });
  } catch (error) {
    console.error('Error processing rebate:', error);
    res.status(500).json({ 
      message: 'Server error', 
      details: error.message 
    });
  }
};

// New method to manage restaurant-specific rebate mappings
exports.manageRestaurantRebateMappings = async (req, res) => {
  try {
    const { restaurantId, containerTypeMappings } = req.body;

    // Validate restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    // Create or update rebate mappings
    const savedMappings = await Promise.all(
      containerTypeMappings.map(async (mapping) => {
        // Validate container type exists
        const containerType = await ContainerType.findById(mapping.containerTypeId);
        if (!containerType) {
          throw new Error(`Container type ${mapping.containerTypeId} not found`);
        }

        return RestaurantContainerRebate.findOneAndUpdate(
          {
            restaurantId: restaurantId,
            containerTypeId: mapping.containerTypeId
          },
          {
            rebateValue: mapping.rebateValue
          },
          { upsert: true, new: true }
        );
      })
    );

    res.status(200).json({
      message: 'Rebate mappings updated successfully',
      mappings: savedMappings
    });
  } catch (error) {
    console.error('Error managing rebate mappings:', error);
    res.status(500).json({ 
      message: 'Error managing rebate mappings', 
      details: error.message 
    });
  }
};

// Retrieve rebate mappings for a restaurant
exports.getRestaurantRebateMappings = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // Validate restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    const rebateMappings = await RestaurantContainerRebate.find({ 
      restaurantId 
    }).populate('containerTypeId');

    res.status(200).json(rebateMappings);
  } catch (error) {
    console.error('Error retrieving rebate mappings:', error);
    res.status(500).json({ 
      message: 'Error retrieving rebate mappings', 
      details: error.message 
    });
  }
};

// Process container return
exports.processReturn = async (req, res) => {
  try {
    const { containerId } = req.body;
    const staffId = req.user._id;
    
    // Find the container
    const container = await Container.findById(containerId);
    
    if (!container) {
      return res.status(404).json({ message: 'Container not found' });
    }
    
    if (!container.customerId) {
      return res.status(400).json({ message: 'Container is not registered to any customer' });
    }
    
    if (container.status === 'returned') {
      return res.status(400).json({ message: 'Container is already marked as returned' });
    }
    
    // Get staff restaurant information
    const staffUser = await mongoose.model('User').findById(staffId)
      .populate('restaurantId');
    
    if (!staffUser || !staffUser.restaurantId) {
      return res.status(400).json({ message: 'Staff user is not associated with a restaurant' });
    }
    
    const restaurant = staffUser.restaurantId;
    const customerId = container.customerId;
    const location = restaurant.name;
    
    // Update container status
    container.status = 'returned';
    container.lastUsed = new Date();
    
    await container.save();
    
    // Record activity
    const newActivity = new Activity({
      userId: customerId,
      containerId,
      containerTypeId: container.containerTypeId,
      restaurantId: restaurant._id,
      type: 'return',
      location,
      notes: 'Container returned'
    });
    
    await newActivity.save();
    
    res.status(200).json({
      success: true,
      message: 'Container marked as returned successfully',
      container
    });
  } catch (error) {
    console.error('Error processing container return:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Generate a QR code for a new container
exports.generateContainer = async (req, res) => {
  try {
    const { containerTypeId, restaurantId } = req.body;
    
    // Validate container type
    const containerType = await ContainerType.findById(containerTypeId);
    if (!containerType) {
      return res.status(404).json({ message: 'Container type not found' });
    }
    
    // Validate restaurant if provided
    if (restaurantId) {
      const restaurant = await mongoose.model('Restaurant').findById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ message: 'Restaurant not found' });
      }
    }
    
    // Generate a unique QR code
    const timestamp = Date.now().toString();
    const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
    const qrCode = `AQRO-${randomString}-${timestamp.slice(-6)}`;
    
    // Create a new container (NO customerId assigned)
    const container = new Container({
      qrCode,
      containerTypeId,
      restaurantId: restaurantId || null,
      status: 'available'  // Mark as 'available' for scanning later
    });
    
    await container.save();
    
    res.status(201).json({
      container,
      qrCode,
      qrCodeUrl: `/api/containers/qrcode/${container._id}`
    });
    
  } catch (error) {
    console.error('Error generating container:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getContainerTypes = async (req, res) => {
  try {
    const containerTypes = await ContainerType.find({ isActive: true });
    res.status(200).json(containerTypes);
  } catch (error) {
    console.error('Error fetching container types:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Retrieve rebate mappings for a specific container type across all restaurants
exports.getContainerTypeRebateMappings = async (req, res) => {
  try {
    const { containerTypeId } = req.params;

    // Validate container type exists
    const containerType = await ContainerType.findById(containerTypeId);
    if (!containerType) {
      return res.status(404).json({ message: 'Container type not found' });
    }

    const rebateMappings = await RestaurantContainerRebate.find({ 
      containerTypeId 
    })
    .populate('restaurantId', 'name')
    .populate('containerTypeId', 'name');

    res.status(200).json(rebateMappings);
  } catch (error) {
    console.error('Error retrieving container type rebate mappings:', error);
    res.status(500).json({ 
      message: 'Error retrieving rebate mappings', 
      details: error.message 
    });
  }
};

exports.getContainerTypeRebateValue = async (req, res) => {
  try {
    const { containerTypeId } = req.params;
    const restaurantId = req.user.restaurantId;

    // Find the specific rebate mapping for this container type and restaurant
    const rebateMapping = await RestaurantContainerRebate.findOne({
      restaurantId,
      containerTypeId
    });

    if (!rebateMapping) {
      return res.status(404).json({ 
        message: 'No specific rebate value found for this container type and restaurant',
        defaultRebateValue: containerType.rebateValue // fallback to default
      });
    }

    res.status(200).json({
      rebateValue: rebateMapping.rebateValue
    });
  } catch (error) {
    console.error('Error retrieving rebate value:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
// Get all restaurants
exports.getRestaurants = async (req, res) => {
  try {
    const restaurants = await mongoose.model('Restaurant').find({ isActive: true });
    res.status(200).json(restaurants);
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get containers for a specific restaurant
exports.getRestaurantContainers = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    // First check if the staff user belongs to this restaurant
    if (req.user.userType === 'staff' && req.user.restaurantId.toString() !== restaurantId) {
      return res.status(403).json({ message: 'Unauthorized access to restaurant data' });
    }
    
    const containers = await Container.find({ restaurantId })
      .populate('containerTypeId')
      .populate('customerId', 'firstName lastName email')
      .sort({ updatedAt: -1 });
    
    res.json(containers);
  } catch (error) {
    console.error('Error getting restaurant containers:', error);
    res.status(500).json({ message: 'Server error' });
  }
};