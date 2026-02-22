import { 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  orderBy, 
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js";
import { db, storage } from './firebase.js';
import { showToast, showLoading, hideLoading, formatPrice, formatDate } from './utils.js';
import { requireAdmin } from './auth.js';

// Check admin access
export function initAdmin() {
  if (!requireAdmin()) return;
  loadDashboardStats();
  loadProducts();
  loadOrders();
  loadUsers();
}

// Dashboard Stats
export async function loadDashboardStats() {
  try {
    // Total users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const totalUsers = usersSnapshot.size;
    
    // Total products
    const productsSnapshot = await getDocs(collection(db, 'products'));
    const totalProducts = productsSnapshot.size;
    
    // Total orders
    const ordersSnapshot = await getDocs(collection(db, 'orders'));
    const totalOrders = ordersSnapshot.size;
    
    // Total revenue
    let totalRevenue = 0;
    ordersSnapshot.forEach(doc => {
      totalRevenue += doc.data().totalAmount || 0;
    });
    
    // Update UI
    updateStat('totalUsers', totalUsers);
    updateStat('totalProducts', totalProducts);
    updateStat('totalOrders', totalOrders);
    updateStat('totalRevenue', formatPrice(totalRevenue));
    
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

function updateStat(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// Products Management
export async function loadProducts() {
  try {
    const snapshot = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc')));
    const products = [];
    snapshot.forEach(doc => {
      products.push({ id: doc.id, ...doc.data() });
    });
    renderProductsTable(products);
  } catch (error) {
    console.error('Error loading products:', error);
  }
}

function renderProductsTable(products) {
  const tbody = document.getElementById('productsTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = products.map(product => `
    <tr>
      <td>
        <div class="product-cell">
          <img src="${product.images?.[0] || '/assets/images/placeholder.jpg'}" alt="">
          <span>${product.name}</span>
        </div>
      </td>
      <td>${product.category}</td>
      <td>${formatPrice(product.finalPrice || product.price)}</td>
      <td>${product.productType === 'digital' ? 'Digital' : product.stock}</td>
      <td><span class="status-badge ${product.productType}">${product.productType}</span></td>
      <td>
        <div class="table-actions">
          <button class="table-btn edit" onclick="editProduct('${product.id}')" title="Edit">
            ✏️
          </button>
          <button class="table-btn delete" onclick="deleteProduct('${product.id}')" title="Delete">
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Add Product
export async function addProduct(productData, images, digitalFile) {
  try {
    showLoading();
    
    const imageUrls = [];
    
    // Upload images
    for (const image of images) {
      const storageRef = ref(storage, `products/${Date.now()}_${image.name}`);
      await uploadBytes(storageRef, image);
      const url = await getDownloadURL(storageRef);
      imageUrls.push(url);
    }
    
    // Upload digital file if present
    let digitalFileURL = null;
    if (digitalFile && productData.productType === 'digital') {
      const fileRef = ref(storage, `digital/${Date.now()}_${digitalFile.name}`);
      await uploadBytes(fileRef, digitalFile);
      digitalFileURL = await getDownloadURL(fileRef);
    }
    
    const finalPrice = productData.discount > 0 
      ? productData.price - (productData.price * productData.discount / 100)
      : productData.price;
    
    await addDoc(collection(db, 'products'), {
      ...productData,
      images: imageUrls,
      digitalFileURL: digitalFileURL,
      finalPrice: finalPrice,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    showToast('Product added successfully!', 'success');
    closeModal();
    loadProducts();
    
  } catch (error) {
    console.error('Error adding product:', error);
    showToast('Failed to add product', 'error');
  } finally {
    hideLoading();
  }
}

// Edit Product
export async function editProduct(productId) {
  try {
    const docRef = doc(db, 'products', productId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      showToast('Product not found', 'error');
      return;
    }
    
    const product = docSnap.data();
    openProductModal(product, productId);
    
  } catch (error) {
    console.error('Error loading product:', error);
    showToast('Failed to load product', 'error');
  }
}

// Update Product
export async function updateProduct(productId, productData, newImages, digitalFile) {
  try {
    showLoading();
    
    const docRef = doc(db, 'products', productId);
    const docSnap = await getDoc(docRef);
    const currentProduct = docSnap.data();
    
    let imageUrls = [...(currentProduct.images || [])];
    
    // Upload new images
    if (newImages.length > 0) {
      for (const image of newImages) {
        const storageRef = ref(storage, `products/${Date.now()}_${image.name}`);
        await uploadBytes(storageRef, image);
        const url = await getDownloadURL(storageRef);
        imageUrls.push(url);
      }
    }
    
    // Upload new digital file
    let digitalFileURL = currentProduct.digitalFileURL;
    if (digitalFile && productData.productType === 'digital') {
      const fileRef = ref(storage, `digital/${Date.now()}_${digitalFile.name}`);
      await uploadBytes(fileRef, digitalFile);
      digitalFileURL = await getDownloadURL(fileRef);
    }
    
    const finalPrice = productData.discount > 0 
      ? productData.price - (productData.price * productData.discount / 100)
      : productData.price;
    
    await updateDoc(docRef, {
      ...productData,
      images: imageUrls,
      digitalFileURL: digitalFileURL,
      finalPrice: finalPrice,
      updatedAt: serverTimestamp()
    });
    
    showToast('Product updated successfully!', 'success');
    closeModal();
    loadProducts();
    
  } catch (error) {
    console.error('Error updating product:', error);
    showToast('Failed to update product', 'error');
  } finally {
    hideLoading();
  }
}

// Delete Product
export async function deleteProduct(productId) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  
  try {
    showLoading();
    
    // Get product to delete images
    const docRef = doc(db, 'products', productId);
    const docSnap = await getDoc(docRef);
    const product = docSnap.data();
    
    // Delete images from storage
    if (product.images) {
      for (const url of product.images) {
        try {
          const imageRef = ref(storage, url);
          await deleteObject(imageRef);
        } catch (e) {
          console.log('Error deleting image:', e);
        }
      }
    }
    
    await deleteDoc(docRef);
    showToast('Product deleted successfully!', 'success');
    loadProducts();
    
  } catch (error) {
    console.error('Error deleting product:', error);
    showToast('Failed to delete product', 'error');
  } finally {
    hideLoading();
  }
}

// Orders Management
export async function loadOrders() {
  try {
    const snapshot = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
    const orders = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    renderOrdersTable(orders);
  } catch (error) {
    console.error('Error loading orders:', error);
  }
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = orders.map(order => `
    <tr>
      <td>#${order.orderId.substring(0, 8).toUpperCase()}</td>
      <td>${order.userName}</td>
      <td>${order.items.length} items</td>
      <td>${formatPrice(order.totalAmount)}</td>
      <td>${formatDate(order.createdAt)}</td>
      <td>
        <select class="status-select" onchange="updateOrderStatus('${order.id}', this.value)">
          <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="Processing" ${order.status === 'Processing' ? 'selected' : ''}>Processing</option>
          <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
          <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </td>
      <td>
        <button class="table-btn edit" onclick="viewOrder('${order.orderId}')" title="View">
          👁️
        </button>
      </td>
    </tr>
  `).join('');
}

export async function updateOrderStatus(orderId, status) {
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status: status,
      updatedAt: serverTimestamp()
    });
    showToast('Order status updated!', 'success');
  } catch (error) {
    console.error('Error updating order:', error);
    showToast('Failed to update status', 'error');
  }
}

// Users Management
export async function loadUsers() {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    const users = [];
    snapshot.forEach(doc => {
      users.push({ id: doc.id, ...doc.data() });
    });
    renderUsersTable(users);
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = users.map(user => `
    <tr>
      <td>
        <div class="user-cell">
          <div class="user-avatar-small">${user.name.charAt(0).toUpperCase()}</div>
          <div>
            <div class="user-name">${user.name}</div>
            <div class="user-email">${user.email}</div>
          </div>
        </div>
      </td>
      <td>${user.email}</td>
      <td><span class="status-badge ${user.role}">${user.role}</span></td>
      <td>${formatDate(user.createdAt)}</td>
      <td>
        <button class="table-btn edit" onclick="toggleUserRole('${user.id}', '${user.role}')" title="Toggle Role">
          🔄
        </button>
      </td>
    </tr>
  `).join('');
}

export async function toggleUserRole(userId, currentRole) {
  try {
    const newRole = currentRole === 'admin' ? 'customer' : 'admin';
    await updateDoc(doc(db, 'users', userId), {
      role: newRole
    });
    showToast(`User role changed to ${newRole}!`, 'success');
    loadUsers();
  } catch (error) {
    console.error('Error updating user:', error);
    showToast('Failed to update user role', 'error');
  }
}

// Modal Functions
export function openProductModal(product = null, productId = null) {
  const modal = document.getElementById('productModal');
  const form = document.getElementById('productForm');
  const title = document.getElementById('modalTitle');
  
  title.textContent = product ? 'Edit Product' : 'Add Product';
  form.dataset.productId = productId || '';
  
  if (product) {
    document.getElementById('productName').value = product.name;
    document.getElementById('productDescription').value = product.description;
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productDiscount').value = product.discount || 0;
    document.getElementById('productCategory').value = product.category;
    document.getElementById('productStock').value = product.stock || 0;
    
    // Set product type
    document.querySelectorAll('.type-option').forEach(opt => {
      opt.classList.remove('selected');
      if (opt.dataset.type === product.productType) {
        opt.classList.add('selected');
      }
    });
    
    // Show existing images
    const preview = document.getElementById('imagePreview');
    if (preview && product.images) {
      preview.innerHTML = product.images.map((img, i) => `
        <div class="preview-item">
          <img src="${img}" alt="">
          <button type="button" class="preview-remove" onclick="removeImage(${i})">×</button>
        </div>
      `).join('');
    }
  } else {
    form.reset();
    document.getElementById('imagePreview').innerHTML = '';
    document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'));
  }
  
  modal.classList.add('show');
}

export function closeModal() {
  const modal = document.getElementById('productModal');
  if (modal) modal.classList.remove('show');
}

// Global functions
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.updateOrderStatus = updateOrderStatus;
window.viewOrder = (orderId) => window.open(`dashboard.html?order=${orderId}`, '_blank');
window.toggleUserRole = toggleUserRole;
window.openProductModal = () => openProductModal();
window.closeModal = closeModal;

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.admin-page')) {
    initAdmin();
  }
  
  // Product type selection
  document.querySelectorAll('.type-option').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
    });
  });
  
  // Product form submission
  const productForm = document.getElementById('productForm');
  if (productForm) {
    productForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const productId = productForm.dataset.productId;
      const productData = {
        name: document.getElementById('productName').value,
        description: document.getElementById('productDescription').value,
        price: parseFloat(document.getElementById('productPrice').value),
        discount: parseInt(document.getElementById('productDiscount').value) || 0,
        category: document.getElementById('productCategory').value,
        stock: parseInt(document.getElementById('productStock').value) || 0,
        productType: document.querySelector('.type-option.selected')?.dataset.type || 'physical'
      };
      
      const imageInput = document.getElementById('productImages');
      const images = imageInput?.files ? Array.from(imageInput.files) : [];
      
      const digitalInput = document.getElementById('digitalFile');
      const digitalFile = digitalInput?.files?.[0] || null;
      
      if (productId) {
        await updateProduct(productId, productData, images, digitalFile);
      } else {
        await addProduct(productData, images, digitalFile);
      }
    });
  }
  
  // Image preview
  const imageInput = document.getElementById('productImages');
  if (imageInput) {
    imageInput.addEventListener('change', (e) => {
      const preview = document.getElementById('imagePreview');
      preview.innerHTML = '';
      
      Array.from(e.target.files).forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const div = document.createElement('div');
          div.className = 'preview-item';
          div.innerHTML = `
            <img src="${e.target.result}" alt="">
            <button type="button" class="preview-remove" onclick="this.parentElement.remove()">×</button>
          `;
          preview.appendChild(div);
        };
        reader.readAsDataURL(file);
      });
    });
  }
  
  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });
  
  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  });
});
