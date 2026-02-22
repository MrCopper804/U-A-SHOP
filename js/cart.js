import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { db } from './firebase.js';
import { showToast, formatPrice, getLocalStorage, setLocalStorage, removeLocalStorage, getCartKey } from './utils.js';
import { getCurrentUser } from './auth.js';

// Get cart from localStorage or Firestore
export async function getCart() {
  const user = getCurrentUser();
  
  if (user) {
    // Get from Firestore
    try {
      const cartDoc = await getDoc(doc(db, 'carts', user.uid));
      if (cartDoc.exists()) {
        return cartDoc.data();
      }
    } catch (error) {
      console.error('Error getting cart:', error);
    }
  }
  
  // Get from localStorage
  const cartKey = getCartKey(user?.uid);
  return getLocalStorage(cartKey, { items: [], total: 0, updatedAt: new Date() });
}

// Save cart
export async function saveCart(cart) {
  const user = getCurrentUser();
  cart.updatedAt = new Date();
  
  if (user) {
    // Save to Firestore
    try {
      await setDoc(doc(db, 'carts', user.uid), {
        ...cart,
        userId: user.uid,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  }
  
  // Save to localStorage
  const cartKey = getCartKey(user?.uid);
  setLocalStorage(cartKey, cart);
  
  // Update UI
  updateCartCount(cart.items.length);
}

// Add to cart
export async function addToCart(productId, quantity = 1) {
  try {
    showLoading();
    
    // Get product details
    const productDoc = await getDoc(doc(db, 'products', productId));
    if (!productDoc.exists()) {
      showToast('Product not found', 'error');
      return;
    }
    
    const product = { id: productDoc.id, ...productDoc.data() };
    
    // Check stock for physical products
    if (product.productType === 'physical' && product.stock < quantity) {
      showToast('Not enough stock available', 'error');
      return;
    }
    
    const cart = await getCart();
    
    // Check if item already in cart
    const existingItem = cart.items.find(item => item.productId === productId);
    
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({
        productId: product.id,
        name: product.name,
        price: product.finalPrice || product.price,
        originalPrice: product.price,
        image: product.images?.[0] || '/assets/images/placeholder.jpg',
        quantity: quantity,
        productType: product.productType,
        maxStock: product.stock
      });
    }
    
    // Recalculate total
    cart.total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    await saveCart(cart);
    showToast('Added to cart!', 'success');
    
    // Animate cart icon
    animateCartIcon();
    
  } catch (error) {
    console.error('Error adding to cart:', error);
    showToast('Failed to add to cart', 'error');
  } finally {
    hideLoading();
  }
}

// Update quantity
export async function updateQuantity(productId, quantity) {
  try {
    const cart = await getCart();
    const item = cart.items.find(item => item.productId === productId);
    
    if (!item) return;
    
    if (quantity <= 0) {
      await removeFromCart(productId);
      return;
    }
    
    // Check stock
    if (item.productType === 'physical' && item.maxStock && quantity > item.maxStock) {
      showToast('Maximum stock reached', 'warning');
      return;
    }
    
    item.quantity = quantity;
    cart.total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    await saveCart(cart);
    renderCart();
    
  } catch (error) {
    console.error('Error updating quantity:', error);
    showToast('Failed to update quantity', 'error');
  }
}

// Remove from cart
export async function removeFromCart(productId) {
  try {
    const cart = await getCart();
    cart.items = cart.items.filter(item => item.productId !== productId);
    cart.total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    await saveCart(cart);
    renderCart();
    showToast('Item removed from cart', 'success');
    
  } catch (error) {
    console.error('Error removing from cart:', error);
    showToast('Failed to remove item', 'error');
  }
}

// Clear cart
export async function clearCart() {
  const cart = { items: [], total: 0, updatedAt: new Date() };
  await saveCart(cart);
}

// Merge cart on login
export async function mergeCartOnLogin(userId) {
  try {
    const guestCart = getLocalStorage('cart_guest', { items: [] });
    const userCartDoc = await getDoc(doc(db, 'carts', userId));
    const userCart = userCartDoc.exists() ? userCartDoc.data() : { items: [] };
    
    // Merge items
    guestCart.items.forEach(guestItem => {
      const existingItem = userCart.items.find(item => item.productId === guestItem.productId);
      if (existingItem) {
        existingItem.quantity += guestItem.quantity;
      } else {
        userCart.items.push(guestItem);
      }
    });
    
    userCart.total = userCart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    userCart.userId = userId;
    userCart.updatedAt = serverTimestamp();
    
    await setDoc(doc(db, 'carts', userId), userCart);
    setLocalStorage(`cart_${userId}`, userCart);
    removeLocalStorage('cart_guest');
    
    updateCartCount(userCart.items.length);
    
  } catch (error) {
    console.error('Error merging cart:', error);
  }
}

// Render cart
export async function renderCart() {
  const cartItemsContainer = document.getElementById('cartItems');
  const cartSummary = document.getElementById('cartSummary');
  
  if (!cartItemsContainer) return;
  
  const cart = await getCart();
  
  if (cart.items.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🛒</div>
        <h3>Your cart is empty</h3>
        <p>Looks like you haven't added anything to your cart yet.</p>
        <a href="index.html" class="btn btn-primary" style="margin-top: 20px;">Continue Shopping</a>
      </div>
    `;
    if (cartSummary) cartSummary.style.display = 'none';
    updateCartCount(0);
    return;
  }
  
  cartItemsContainer.innerHTML = cart.items.map(item => `
    <div class="cart-item" data-id="${item.productId}">
      <div class="cart-item-image">
        <img src="${item.image}" alt="${item.name}">
      </div>
      <div class="cart-item-details">
        <h3>${item.name}</h3>
        <div class="cart-item-meta">
          <span>${item.productType === 'digital' ? 'Digital Download' : 'Physical Product'}</span>
          <span>•</span>
          <span>${formatPrice(item.price)} each</span>
        </div>
        <div class="cart-item-price">${formatPrice(item.price * item.quantity)}</div>
        <button class="remove-btn" onclick="removeFromCart('${item.productId}')">
          🗑️ Remove
        </button>
      </div>
      <div class="cart-item-actions">
        <div class="quantity-control">
          <button class="qty-btn" onclick="updateCartQuantity('${item.productId}', ${item.quantity - 1})">-</button>
          <input type="text" class="qty-input" value="${item.quantity}" readonly>
          <button class="qty-btn" onclick="updateCartQuantity('${item.productId}', ${item.quantity + 1})">+</button>
        </div>
      </div>
    </div>
  `).join('');
  
  // Render summary
  if (cartSummary) {
    cartSummary.style.display = 'block';
    const subtotal = cart.total;
    const shipping = subtotal > 50 ? 0 : 5.99;
    const total = subtotal + shipping;
    
    cartSummary.innerHTML = `
      <h2>Order Summary</h2>
      <div class="summary-row">
        <span>Subtotal (${cart.items.length} items)</span>
        <span>${formatPrice(subtotal)}</span>
      </div>
      <div class="summary-row">
        <span>Shipping</span>
        <span>${shipping === 0 ? 'FREE' : formatPrice(shipping)}</span>
      </div>
      <div class="summary-row">
        <span>Tax</span>
        <span>Calculated at checkout</span>
      </div>
      <div class="summary-row total">
        <span>Estimated Total</span>
        <span>${formatPrice(total)}</span>
      </div>
      <button class="btn btn-primary btn-lg checkout-btn" onclick="window.location.href='checkout.html'">
        Proceed to Checkout
      </button>
      <a href="index.html" class="continue-shopping">← Continue Shopping</a>
    `;
  }
  
  updateCartCount(cart.items.length);
}

// Update cart count badge
function updateCartCount(count) {
  document.querySelectorAll('.cart-count').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
}

// Animate cart icon
function animateCartIcon() {
  const cartIcon = document.querySelector('.cart-icon');
  if (cartIcon) {
    cartIcon.style.transform = 'scale(1.3)';
    setTimeout(() => {
      cartIcon.style.transform = 'scale(1)';
    }, 200);
  }
}

// Global functions
window.updateCartQuantity = updateQuantity;
window.removeFromCart = removeFromCart;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  updateCartCount(0);
  if (document.getElementById('cartItems')) {
    renderCart();
  }
});
