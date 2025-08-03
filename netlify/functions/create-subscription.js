const Razorpay = require('razorpay');

exports.handler = async (event) => {
  try {
    // Add affiliate_id to the destructured parameters
    const { name, email, phone, plan_id = "plan_R0lfqw7y18smql", affiliate_id } = JSON.parse(event.body);
    
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_SECRET
    });

    const subscription = await razorpay.subscriptions.create({
      plan_id: plan_id,
      customer_notify: 1,
      total_count: 12,
      notes: {
        user_name: name,
        user_email: email,
        user_phone: phone,
        // Add affiliate ID to Razorpay notes
        affiliate_id: affiliate_id || 'direct',
        created_via: "TraderLog Web"
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        id: subscription.id,
        status: subscription.status,
        // Return affiliate ID for frontend confirmation
        affiliate_id: affiliate_id || 'direct'
      })
    };
  } catch (error) {
    let errorMessage = "Subscription creation failed";
    if (error.error?.description) errorMessage = error.error.description;
    else if (error.message) errorMessage = error.message;
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: errorMessage,
        details: error.error || "Please check your input",
        // Include affiliate ID in error response for debugging
        affiliate_id: affiliate_id || 'direct'
      })
    };
  }
};