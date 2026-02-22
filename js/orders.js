import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  doc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { db } from './firebase.js';
import { showToast, showLoading, hideLoading, formatPrice, formatDate, generateId } from './utils.js';
import { getCurrentUser, requireAuth } from './auth.js';
import { getCart, clearCart } from './cart.js';

// Create order
export async function createOrder(shippingInfo) {
  try {
    showLoading();
    
    if (!requireAuth()) return;
    
    const user = getCurrentUser();
    const cart = await getCart();
    
    if (cart.items.length === 0) {
      showToast('Your cart is empty', 'error');
      window.location.href = 'cart.html';
      return;
    }
    
    // Validate stock for physical products
    for (const item of cart.items) {
      if (item.productType === 'physical') {
        const productDoc = await getDoc(doc(db, 'products', item.productId));
        if (productDoc.exists()) {
          const product = productDoc.data();
          if (product.stock < item.quantity) {
            throw new Error(`Not enough stock for ${item.name}. Available: ${product.stock}`);
          }
        }
      }
    }
    
    const orderId = generateId();
    const shipping = cart.total > 50 ? 0 : 5.99;
    const totalAmount = cart.total + shipping;
    
    const order = {
      orderId: orderId,
      userId: user.uid,
      userEmail: user.email,
      userName: user.name,
      items: cart.items,
      subtotal: cart.total,
      shipping: shipping,
      totalAmount: totalAmount,
      paymentMethod: 'COD',
      status: 'Pending',
      shippingInfo: shippingInfo,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Save order
    await addDoc(collection(db, 'orders'), order);
    
    // Update stock for physical products
    for (const item of cart.items) {
      if (item.productType === 'physical') {
        const productRef = doc(db, 'products', item.productId);
        const productDoc = await getDoc(productRef);
        if (productDoc.exists()) {
          const currentStock = productDoc.data().stock;
          await updateDoc(productRef, {
            stock: currentStock - item.quantity
          });
        }
      }
    }
    
    // Clear cart
    await clearCart();
    
    showToast('Order placed successfully!', 'success');
    window.location.href = `dashboard.html?order=${orderId}`;
    
  } catch (error) {
    console.error('Error creating order:', error);
    showToast(error.message, 'error');
  } finally {
    hideLoading();
  }
}

// Get user orders
export async function getUserOrders() {
  try {
    const user = getCurrentUser();
    if (!user) return [];
    
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const orders = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    
    return orders;
  } catch (error) {
    console.error('Error getting orders:', error);
    return [];
  }
}

// Get order by ID
export async function getOrder(orderId) {
  try {
    const q = query(collection(db, 'orders'), where('orderId', '==', orderId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('Error getting order:', error);
    return null;
  }
}

// Render orders list
export async function renderOrders() {
  const container = document.getElementById('ordersList');
  if (!container) return;
  
  container.innerHTML = '<div class="loading" style="margin: 40px auto;"></div>';
  
  const orders = await getUserOrders();
  
  if (orders.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <h3>No orders yet</h3>
        <p>You haven't placed any orders yet. Start shopping!</p>
        <a href="index.html" class="btn btn-primary" style="margin-top: 20px;">Start Shopping</a>
      </div>
    `;
    return;
  }
  
  container.innerHTML = orders.map(order => `
    <div class="order-card">
      <div class="order-header">
        <div class="order-info">
          <span class="order-id">Order #${order.orderId.substring(0, 8).toUpperCase()}</span>
          <span class="order-date">${formatDate(order.createdAt)}</span>
        </div>
        <span class="status-badge ${order.status.toLowerCase()}">${order.status}</span>
      </div>
      
      <div class="order-items">
        ${order.items.map(item => `
          <div class="order-item-row">
            <img src="${item.image}" alt="${item.name}">
            <div class="order-item-info">
              <h4>${item.name}</h4>
              <p>Qty: ${item.quantity} × ${formatPrice(item.price)}</p>
            </div>
            ${item.productType === 'digital' && order.status === 'Delivered' ? `
              <a href="${item.digitalFileURL || '#'}" class="btn btn-sm btn-secondary download-btn" download>
                ⬇️ Download
              </a>
            ` : ''}
          </div>
        `).join('')}
      </div>
      
      <div class="order-footer">
        <div class="order-total">
          <span>Total:</span>
          <strong>${formatPrice(order.totalAmount)}</strong>
        </div>
        <button class="btn btn-outline btn-sm" onclick="viewOrderDetails('${order.orderId}')">
          View Details
        </button>
      </div>
    </div>
  `).join('');
}

// Render order details
export async function renderOrderDetails(orderId) {
  const container = document.getElementById('orderDetails');
  if (!container) return;
  
  const order = await getOrder(orderId);
  if (!order) {
    container.innerHTML = '<div class="empty-state"><h3>Order not found</h3></div>';
    return;
  }
  
  container.innerHTML = `
    <div class="order-detail-card">
      <div class="order-detail-header">
        <div>
          <h2>Order #${order.orderId.substring(0, 8).toUpperCase()}</h2>
          <p>Placed on ${formatDate(order.createdAt)}</p>
        </div>
        <span class="status-badge ${order.status.toLowerCase()}">${order.status}</span>
      </div>
      
      <div class="order-detail-grid">
        <div class="detail-section">
          <h3>Order Items</h3>
          ${order.items.map(item => `
            <div class="detail-item">
              <img src="${item.image}" alt="${item.name}">
              <div class="detail-item-info">
                <h4>${item.name}</h4>
                <p>${formatPrice(item.price)} × ${item.quantity}</p>
                ${item.productType === 'digital' && order.status === 'Delivered' ? `
                  <a href="${item.digitalFileURL || '#'}" class="download-link" download>
                    ⬇️ Download File
                  </a>
                ` : item.productType === 'digital' ? `
                  <p class="pending-download">Available after delivery</p>
                ` : ''}
              </div>
              <span class="item-total">${formatPrice(item.price * item.quantity)}</span>
            </div>
          `).join('')}
        </div>
        
        <div class="detail-sidebar">
          <div class="detail-section">
            <h3>Order Summary</h3>
            <div class="summary-line">
              <span>Subtotal</span>
              <span>${formatPrice(order.subtotal)}</span>
            </div>
            <div class="summary-line">
              <span>Shipping</span>
              <span>${order.shipping === 0 ? 'FREE' : formatPrice(order.shipping)}</span>
            </div>
            <div class="summary-line total">
              <span>Total</span>
              <span>${formatPrice(order.totalAmount)}</span>
            </div>
          </div>
          
          <div class="detail-section">
            <h3>Shipping Address</h3>
            <p>${order.shippingInfo.fullName}</p>
            <p>${order.shippingInfo.address}</p>
            <p>${order.shippingInfo.city}, ${order.shippingInfo.state} ${order.shippingInfo.zip}</p>
            <p>${order.shippingInfo.country}</p>
            <p>📞 ${order.shippingInfo.phone}</p>
          </div>
          
          <div class="detail-section">
            <h3>Payment Method</h3>
            <p>💵 Cash on Delivery</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Checkout form handler
document.addEventListener('DOMContentLoaded', () => {
  const checkoutForm = document.getElementById('checkoutForm');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const shippingInfo = {
        fullName: document.getElementById('fullName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        address: document.getElementById('address').value,
        city: document.getElementById('city').value,
        state: document.getElementById('state').value,
        zip: document.getElementById('zip').value,
        country: document.getElementById('country').value
      };
      
      await createOrder(shippingInfo);
    });
  }
  
  // Load orders on dashboard
  if (document.getElementById('ordersList')) {
    renderOrders();
  }
  
  // Load order details if order ID in URL
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('order');
  if (orderId && document.getElementById('orderDetails')) {
    renderOrderDetails(orderId);
  }
});

// Global functions
window.viewOrderDetails = function(orderId) {
  window.location.href = `dashboard.html?order=${orderId}`;
};
