import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { logOut, auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, doc, getDoc, setDoc, deleteDoc, updateDoc, addDoc } from 'firebase/firestore';
import { ShoppingBag, Settings, LogOut, Plus, Edit2, Trash2, Share2, Copy, CheckCircle2, ListTodo, Clock, Image as ImageIcon, BarChart3, Tag, Truck, MapPin } from 'lucide-react';
import { SacoleIcon } from '../components/SacoleIcon';
import { compressImage, THEMES } from '../utils/helpers';

export default function AdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [store, setStore] = useState<any>(null);
  const theme = THEMES[(store?.theme as keyof typeof THEMES) || 'orange'];
  
  useEffect(() => {
    if (!auth.currentUser) return;
    
    const storeRef = doc(db, 'stores', auth.currentUser.uid);
    const unsubscribe = onSnapshot(storeRef, (docSnap) => {
      if (docSnap.exists()) {
        setStore({ id: docSnap.id, ...docSnap.data() });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'stores');
    });
    
    return () => unsubscribe();
  }, []);

  const navItems = [
    { path: '/admin', icon: <BarChart3 className="w-6 h-6" />, label: 'Dashboard' },
    { path: '/admin/pedidos', icon: <ShoppingBag className="w-6 h-6" />, label: 'Pedidos' },
    { path: '/admin/sabores', icon: <SacoleIcon className="w-6 h-6" />, label: 'Produtos' },
    { path: '/admin/fabricacao', icon: <Clock className="w-6 h-6" />, label: 'Fabricação' },
    { path: '/admin/compras', icon: <ListTodo className="w-6 h-6" />, label: 'Compras' },
    { path: '/admin/promocoes', icon: <Tag className="w-6 h-6" />, label: 'Promoções' },
    { path: '/admin/configuracoes', icon: <Settings className="w-6 h-6" />, label: 'Ajustes' },
  ];

  return (
    <div className={`min-h-screen ${theme.light} flex flex-col md:flex-row pb-20 md:pb-0`}>
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex bg-white w-64 shadow-xl min-h-screen flex-col sticky top-0">
        <div className={`p-6 flex items-center gap-3 border-b ${theme.border}`}>
          <div className={`${theme.light} p-2 rounded-full`}>
            <SacoleIcon className={`${theme.text} w-8 h-8`} />
          </div>
          <h2 className="font-bold text-xl text-gray-800">Sacolés</h2>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 flex flex-col">
          {navItems.map(item => (
            <Link key={item.path} to={item.path} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${location.pathname === item.path ? `${theme.primary} text-white` : `text-gray-600 ${theme.hoverLight}`}`}>
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
        
        <div className={`p-4 border-t ${theme.border}`}>
          <button onClick={logOut} className="flex items-center gap-3 p-3 w-full rounded-xl text-red-500 hover:bg-red-50 transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Bottom Navigation (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 z-50 pb-safe">
        {navItems.map(item => (
          <Link key={item.path} to={item.path} className={`flex flex-col items-center p-2 rounded-lg ${location.pathname === item.path ? `${theme.text}` : 'text-gray-500'}`}>
            {item.icon}
            <span className="text-[10px] font-medium mt-1">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <Routes>
          <Route path="/" element={<DashboardStats store={store} />} />
          <Route path="/pedidos" element={<Orders store={store} />} />
          <Route path="/sabores" element={<Flavors store={store} />} />
          <Route path="/fabricacao" element={<Manufacturing store={store} />} />
          <Route path="/compras" element={<ShoppingList store={store} />} />
          <Route path="/promocoes" element={<Promotions store={store} />} />
          <Route path="/configuracoes" element={<SettingsPage store={store} />} />
        </Routes>
      </main>
    </div>
  );
}

function DashboardStats({ store }: { store: any }) {
  const theme = THEMES[(store?.theme as keyof typeof THEMES) || 'orange'];
  const [orders, setOrders] = useState<any[]>([]);
  const [flavors, setFlavors] = useState<any[]>([]);
  
  useEffect(() => {
    if (!store?.id) return;
    
    const ordersRef = collection(db, 'stores', store.id, 'orders');
    const unsubOrders = onSnapshot(ordersRef, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
    });

    const flavorsRef = collection(db, 'stores', store.id, 'flavors');
    const unsubFlavors = onSnapshot(flavorsRef, (snapshot) => {
      setFlavors(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
    });
    
    return () => { unsubOrders(); unsubFlavors(); };
  }, [store?.id]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const completedOrders = orders.filter(o => o.status === 'completed');
  
  const todayOrders = completedOrders.filter(o => new Date(o.createdAt) >= today);
  const todayProfit = todayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  
  const monthOrders = completedOrders.filter(o => new Date(o.createdAt) >= firstDayOfMonth);
  const monthProfit = monthOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  // Calculate best selling flavors
  const flavorSales: { [key: string]: number } = {};
  completedOrders.forEach(order => {
    order.items.forEach((item: any) => {
      flavorSales[item.flavorId] = (flavorSales[item.flavorId] || 0) + item.quantity;
    });
  });

  const bestSellers = Object.entries(flavorSales)
    .map(([id, count]) => {
      const flavor = flavors.find(f => f.id === id);
      return { name: flavor?.name || 'Desconhecido', count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 md:mb-8">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className={`bg-white p-6 rounded-3xl shadow-sm border ${theme.border}`}>
          <h3 className="text-gray-500 font-medium mb-2">Lucro de Hoje</h3>
          <p className="text-3xl font-bold text-green-600">R$ {todayProfit.toFixed(2).replace('.', ',')}</p>
          <p className="text-sm text-gray-400 mt-2">{todayOrders.length} pedidos concluídos</p>
        </div>
        
        <div className={`bg-white p-6 rounded-3xl shadow-sm border ${theme.border}`}>
          <h3 className="text-gray-500 font-medium mb-2">Lucro do Mês</h3>
          <p className="text-3xl font-bold text-blue-600">R$ {monthProfit.toFixed(2).replace('.', ',')}</p>
          <p className="text-sm text-gray-400 mt-2">{monthOrders.length} pedidos concluídos</p>
        </div>

        <div className={`bg-white p-6 rounded-3xl shadow-sm border ${theme.border}`}>
          <h3 className="text-gray-500 font-medium mb-2">Total de Pedidos</h3>
          <p className={`text-3xl font-bold ${theme.text}`}>{orders.length}</p>
          <p className="text-sm text-gray-400 mt-2">Desde o início</p>
        </div>
      </div>

      <div className={`bg-white p-6 rounded-3xl shadow-sm border ${theme.border}`}>
        <h3 className="text-xl font-bold text-gray-800 mb-4">Produtos Mais Vendidos</h3>
        {bestSellers.length > 0 ? (
          <div className="space-y-4">
            {bestSellers.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full ${theme.light} ${theme.text} flex items-center justify-center font-bold`}>
                    {index + 1}
                  </span>
                  <span className="font-medium text-gray-700">{item.name}</span>
                </div>
                <span className="font-bold text-gray-800">{item.count} un</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">Nenhum dado de vendas ainda.</p>
        )}
      </div>
    </div>
  );
}

function Orders({ store }: { store: any }) {
  const theme = THEMES[(store?.theme as keyof typeof THEMES) || 'orange'];
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!store?.id) return;
    
    const ordersRef = collection(db, 'stores', store.id, 'orders');
    const unsubscribe = onSnapshot(ordersRef, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      ordersData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(ordersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `stores/${store.id}/orders`);
    });
    
    return () => unsubscribe();
  }, [store?.id]);

  const updateStatus = async (orderId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'stores', store.id, 'orders', orderId), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stores/${store.id}/orders/${orderId}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">Pendente</span>;
      case 'paid': return <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">Pago</span>;
      case 'completed': return <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">Entregue</span>;
      case 'cancelled': return <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">Cancelado</span>;
      default: return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Pedidos</h1>
      </div>
      
      {orders.length === 0 ? (
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm text-center">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-600">Nenhum pedido ainda</h3>
          <p className="text-gray-400 mt-2">Compartilhe sua loja para começar a receber pedidos!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <div key={order.id} className={`bg-white p-4 md:p-6 rounded-3xl shadow-sm border ${theme.border}`}>
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-gray-800">{order.customerName}</h3>
                  <p className="text-gray-500">{order.customerPhone}</p>
                  <p className="text-xs md:text-sm text-gray-400 mt-1">{new Date(order.createdAt).toLocaleString('pt-BR')}</p>
                </div>
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-2">
                  {getStatusBadge(order.status)}
                  <div className="text-right">
                    <span className={`font-bold text-lg ${theme.text} block`}>
                      R$ {order.totalAmount.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-xs text-gray-500 uppercase font-medium">{order.paymentMethod}</span>
                  </div>
                </div>
              </div>
              
              {(order.deliveryMethod || order.deliveryAddress) && (
                <div className="bg-blue-50 p-3 md:p-4 rounded-xl mb-4 flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-blue-800 font-medium">
                    {order.deliveryMethod === 'delivery' ? <Truck className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                    {order.deliveryMethod === 'delivery' ? 'Entrega' : 'Retirada'}
                  </div>
                  {order.deliveryAddress && (
                    <p className="text-sm text-blue-700">{order.deliveryAddress}</p>
                  )}
                  {order.deliveryFee > 0 && (
                    <p className="text-sm text-blue-700">Taxa: R$ {order.deliveryFee.toFixed(2).replace('.', ',')}</p>
                  )}
                </div>
              )}

              <div className={`${theme.light} p-3 md:p-4 rounded-xl mb-4`}>
                <h4 className="font-medium text-gray-700 mb-2 text-sm md:text-base">Itens:</h4>
                <ul className="space-y-1">
                  {order.items.map((item: any, i: number) => (
                    <li key={i} className="flex justify-between text-gray-600 text-sm md:text-base">
                      <span>{item.quantity}x {item.name}</span>
                      <span>R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {order.status === 'pending' && (
                  <button onClick={() => updateStatus(order.id, 'paid')} className="flex-1 md:flex-none bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-medium transition-colors text-sm md:text-base text-center">
                    Marcar Pago
                  </button>
                )}
                {order.status === 'paid' && (
                  <button onClick={() => updateStatus(order.id, 'pending')} className="flex-1 md:flex-none bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-xl font-medium transition-colors text-sm md:text-base text-center">
                    Desmarcar Pago
                  </button>
                )}
                {(order.status === 'pending' || order.status === 'paid') && (
                  <button onClick={() => updateStatus(order.id, 'completed')} className="flex-1 md:flex-none bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl font-medium transition-colors text-sm md:text-base text-center">
                    Entregar
                  </button>
                )}
                {order.status === 'completed' && (
                  <button onClick={() => updateStatus(order.id, 'paid')} className="flex-1 md:flex-none bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-xl font-medium transition-colors text-sm md:text-base text-center">
                    Desmarcar Entrega
                  </button>
                )}
                {order.status !== 'cancelled' && order.status !== 'completed' && (
                  <button onClick={() => updateStatus(order.id, 'cancelled')} className="flex-1 md:flex-none bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-xl font-medium transition-colors text-sm md:text-base text-center">
                    Cancelar
                  </button>
                )}
                {order.status === 'cancelled' && (
                  <button onClick={() => updateStatus(order.id, 'pending')} className="flex-1 md:flex-none bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl font-medium transition-colors text-sm md:text-base text-center">
                    Restaurar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Flavors({ store }: { store: any }) {
  const theme = THEMES[(store?.theme as keyof typeof THEMES) || 'orange'];
  const [flavors, setFlavors] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingFlavor, setEditingFlavor] = useState<any>(null);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Sacolé');
  const [available, setAvailable] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [stock, setStock] = useState('');
  const [productionTime, setProductionTime] = useState('');

  useEffect(() => {
    if (!store?.id) return;
    
    const flavorsRef = collection(db, 'stores', store.id, 'flavors');
    const unsubscribe = onSnapshot(flavorsRef, (snapshot) => {
      const flavorsData = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      setFlavors(flavorsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `stores/${store.id}/flavors`);
    });
    
    return () => unsubscribe();
  }, [store?.id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await compressImage(file);
        setImageUrl(base64);
      } catch (err) {
        console.error("Error compressing image", err);
        alert("Erro ao processar imagem. Tente uma imagem menor.");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store?.id) return;
    
    try {
      const flavorData = {
        name,
        description,
        price: parseFloat(price.replace(',', '.')),
        category,
        available,
        imageUrl,
        stock: parseInt(stock) || 0,
        productionTime: parseInt(productionTime) || 0,
        createdAt: editingFlavor ? editingFlavor.createdAt : new Date().toISOString()
      };

      if (editingFlavor) {
        await updateDoc(doc(db, 'stores', store.id, 'flavors', editingFlavor.id), flavorData);
      } else {
        const newRef = doc(collection(db, 'stores', store.id, 'flavors'));
        await setDoc(newRef, flavorData);
      }
      
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingFlavor ? OperationType.UPDATE : OperationType.CREATE, `stores/${store.id}/flavors`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!store?.id) return;
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      try {
        await deleteDoc(doc(db, 'stores', store.id, 'flavors', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `stores/${store.id}/flavors/${id}`);
      }
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrice('');
    setCategory('Sacolé');
    setAvailable(true);
    setImageUrl('');
    setStock('');
    setProductionTime('');
    setIsAdding(false);
    setEditingFlavor(null);
  };

  const editFlavor = (flavor: any) => {
    setName(flavor.name);
    setDescription(flavor.description || '');
    setPrice(flavor.price.toString());
    setCategory(flavor.category || 'Sacolé');
    setAvailable(flavor.available);
    setImageUrl(flavor.imageUrl || '');
    setStock(flavor.stock?.toString() || '0');
    setProductionTime(flavor.productionTime?.toString() || '0');
    setEditingFlavor(flavor);
    setIsAdding(true);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Produtos</h1>
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} className={`${theme.primary} ${theme.hover} text-white px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 text-sm md:text-base`}>
            <Plus className="w-5 h-5" />
            Novo Produto
          </button>
        )}
      </div>

      {isAdding && (
        <div className={`bg-white p-4 md:p-6 rounded-3xl shadow-sm mb-8 border ${theme.border}`}>
          <h2 className="text-xl font-bold text-gray-800 mb-4">{editingFlavor ? 'Editar Produto' : 'Adicionar Novo Produto'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="flex flex-col md:flex-row gap-4">
              <div className="w-full md:w-32 h-32 bg-gray-100 rounded-2xl flex items-center justify-center overflow-hidden relative border-2 border-dashed border-gray-300">
                {imageUrl ? (
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                )}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Produto</label>
                  <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-opacity-50 outline-none" placeholder="Ex: Morango com Nutella" />
                </div>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                    <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-opacity-50 outline-none">
                      <option value="Sacolé">Sacolé</option>
                      <option value="Bolo de Pote">Bolo de Pote</option>
                      <option value="Pudim">Pudim</option>
                      <option value="Mousse">Mousse</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$)</label>
                    <input required type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-opacity-50 outline-none" placeholder="Ex: 5.00" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estoque</label>
                    <input required type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-opacity-50 outline-none" placeholder="Ex: 10" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tempo (min)</label>
                    <input required type="number" min="0" value={productionTime} onChange={e => setProductionTime(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-opacity-50 outline-none" placeholder="Ex: 30" />
                  </div>
                  <div className="flex items-center pt-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={available} onChange={e => setAvailable(e.target.checked)} className={`w-5 h-5 ${theme.text} rounded focus:ring-opacity-50`} />
                      <span className="text-gray-700 font-medium">Disponível</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (opcional)</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-opacity-50 outline-none resize-none" rows={2} placeholder="Ex: Feito com morangos frescos" />
            </div>
            
            <div className="flex gap-3 pt-4">
              <button type="submit" className={`flex-1 md:flex-none ${theme.primary} ${theme.hover} text-white px-6 py-3 rounded-xl font-medium transition-colors`}>
                {editingFlavor ? 'Salvar' : 'Adicionar'}
              </button>
              <button type="button" onClick={resetForm} className="flex-1 md:flex-none bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-medium transition-colors">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {flavors.map(flavor => (
          <div key={flavor.id} className={`bg-white p-4 md:p-5 rounded-3xl shadow-sm border flex gap-4 ${flavor.available ? `${theme.border}` : 'border-gray-200 opacity-75'}`}>
            <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-100 rounded-2xl flex-shrink-0 overflow-hidden flex items-center justify-center">
              {flavor.imageUrl ? (
                <img src={flavor.imageUrl} alt={flavor.name} className="w-full h-full object-cover" />
              ) : (
                <SacoleIcon className="w-8 h-8 text-gray-300" />
              )}
            </div>
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-1">
                <h3 className="text-lg font-bold text-gray-800 leading-tight">{flavor.name}</h3>
                <span className={`font-bold ${theme.text} whitespace-nowrap ml-2`}>
                  R$ {flavor.price.toFixed(2).replace('.', ',')}
                </span>
              </div>
              {flavor.description && <p className="text-gray-500 text-xs md:text-sm line-clamp-2 mb-2">{flavor.description}</p>}
              
              <div className="mt-auto flex justify-between items-center pt-2">
                <span className={`text-xs font-medium px-2 py-1 rounded-md ${flavor.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {flavor.available ? 'Disponível' : 'Esgotado'}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => editFlavor(flavor)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                  <button onClick={() => handleDelete(flavor.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Manufacturing({ store }: { store: any }) {
  const theme = THEMES[(store?.theme as keyof typeof THEMES) || 'orange'];
  const [batches, setBatches] = useState<any[]>([]);
  const [flavors, setFlavors] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  
  const [flavorId, setFlavorId] = useState('');
  const [quantity, setQuantity] = useState('');

  useEffect(() => {
    if (!store?.id) return;
    
    // Fetch flavors for dropdown
    const flavorsRef = collection(db, 'stores', store.id, 'flavors');
    const unsubFlavors = onSnapshot(flavorsRef, (snapshot) => {
      setFlavors(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
    });

    // Fetch batches
    const batchesRef = collection(db, 'stores', store.id, 'batches');
    const unsubBatches = onSnapshot(batchesRef, (snapshot) => {
      const batchesData = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      batchesData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBatches(batchesData);
    });
    
    return () => { unsubFlavors(); unsubBatches(); };
  }, [store?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store?.id || !flavorId) return;
    
    const flavor = flavors.find(f => f.id === flavorId);
    if (!flavor) return;

    try {
      await addDoc(collection(db, 'stores', store.id, 'batches'), {
        flavorId,
        flavorName: flavor.name,
        quantity: parseInt(quantity),
        status: 'preparing',
        createdAt: new Date().toISOString()
      });
      setIsAdding(false);
      setFlavorId('');
      setQuantity('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `stores/${store.id}/batches`);
    }
  };

  const updateStatus = async (batchId: string, status: string) => {
    try {
      const data: any = { status };
      if (status === 'freezing') {
        // Estimate 12 hours for freezing
        const readyAt = new Date();
        readyAt.setHours(readyAt.getHours() + 12);
        data.readyAt = readyAt.toISOString();
      }
      await updateDoc(doc(db, 'stores', store.id, 'batches', batchId), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stores/${store.id}/batches/${batchId}`);
    }
  };

  const deleteBatch = async (batchId: string) => {
    try {
      await deleteDoc(doc(db, 'stores', store.id, 'batches', batchId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stores/${store.id}/batches/${batchId}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Fabricação</h1>
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} className={`${theme.primary} ${theme.hover} text-white px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 text-sm md:text-base`}>
            <Plus className="w-5 h-5" />
            Nova Fornada
          </button>
        )}
      </div>

      {isAdding && (
        <div className={`bg-white p-4 md:p-6 rounded-3xl shadow-sm mb-8 border ${theme.border}`}>
          <h2 className="text-xl font-bold text-gray-800 mb-4">Registrar Produção</h2>
          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Produto</label>
              <select required value={flavorId} onChange={e => setFlavorId(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-opacity-50 outline-none bg-white">
                <option value="">Selecione um produto...</option>
                {flavors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="w-full md:w-32">
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
              <input required type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-opacity-50 outline-none" placeholder="Qtd" />
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className={`${theme.primary} ${theme.hover} text-white px-6 py-3 rounded-xl font-medium transition-colors`}>
                Iniciar
              </button>
              <button type="button" onClick={() => setIsAdding(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-xl font-medium transition-colors">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {batches.map(batch => (
          <div key={batch.id} className={`bg-white p-4 md:p-5 rounded-3xl shadow-sm border ${theme.border} flex flex-col md:flex-row justify-between md:items-center gap-4`}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-lg text-gray-800">{batch.flavorName}</span>
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-sm font-medium">{batch.quantity} un</span>
              </div>
              <p className="text-xs text-gray-400">Iniciado em: {new Date(batch.createdAt).toLocaleString('pt-BR')}</p>
              {batch.status === 'freezing' && batch.readyAt && (
                <p className="text-sm text-blue-600 font-medium mt-1">
                  Pronto aprox: {new Date(batch.readyAt).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {batch.status === 'preparing' && (
                <>
                  <span className="bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-lg text-sm font-medium">Preparando</span>
                  <button onClick={() => updateStatus(batch.id, 'freezing')} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                    Colocar no Freezer
                  </button>
                </>
              )}
              {batch.status === 'freezing' && (
                <>
                  <span className="bg-blue-100 text-blue-800 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1">
                    <Clock className="w-4 h-4" /> Congelando
                  </span>
                  <button onClick={() => updateStatus(batch.id, 'ready')} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                    Marcar Pronto
                  </button>
                </>
              )}
              {batch.status === 'ready' && (
                <span className="bg-green-100 text-green-800 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Pronto para Venda
                </span>
              )}
              <button onClick={() => deleteBatch(batch.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-auto md:ml-2">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        {batches.length === 0 && !isAdding && (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhuma produção em andamento.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ShoppingList({ store }: { store: any }) {
  const theme = THEMES[(store?.theme as keyof typeof THEMES) || 'orange'];
  const [items, setItems] = useState<any[]>([]);
  const [newItem, setNewItem] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('un');

  useEffect(() => {
    if (!store?.id) return;
    
    const itemsRef = collection(db, 'stores', store.id, 'shoppingList');
    const unsubscribe = onSnapshot(itemsRef, (snapshot) => {
      const itemsData = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      itemsData.sort((a, b) => {
        if (a.completed === b.completed) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return a.completed ? 1 : -1;
      });
      setItems(itemsData);
    });
    
    return () => unsubscribe();
  }, [store?.id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store?.id || !newItem.trim() || !quantity) return;
    
    try {
      await addDoc(collection(db, 'stores', store.id, 'shoppingList'), {
        name: newItem.trim(),
        quantity: parseInt(quantity),
        unit: unit.trim(),
        completed: false,
        createdAt: new Date().toISOString()
      });
      setNewItem('');
      setQuantity('');
      setUnit('un');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `stores/${store.id}/shoppingList`);
    }
  };

  const toggleItem = async (id: string, completed: boolean) => {
    try {
      await updateDoc(doc(db, 'stores', store.id, 'shoppingList', id), { completed });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stores/${store.id}/shoppingList/${id}`);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'stores', store.id, 'shoppingList', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stores/${store.id}/shoppingList/${id}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 md:mb-8">Lista de Compras</h1>
      
      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 mb-6">
        <input 
          type="text" 
          value={newItem} 
          onChange={e => setNewItem(e.target.value)} 
          placeholder="Item" 
          className="flex-1 min-w-[150px] p-3 md:p-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-opacity-50 outline-none shadow-sm"
        />
        <input 
          type="number" 
          value={quantity} 
          onChange={e => setQuantity(e.target.value)} 
          placeholder="Qtd" 
          className="w-20 p-3 md:p-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-opacity-50 outline-none shadow-sm"
        />
        <input 
          type="text" 
          value={unit} 
          onChange={e => setUnit(e.target.value)} 
          placeholder="Un" 
          className="w-20 p-3 md:p-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-opacity-50 outline-none shadow-sm"
        />
        <button type="submit" className={`${theme.primary} ${theme.hover} text-white px-4 md:px-6 py-3 md:py-4 rounded-2xl font-medium transition-colors shadow-sm`}>
          <Plus className="w-6 h-6" />
        </button>
      </form>

      <div className={`bg-white rounded-3xl shadow-sm border ${theme.border} overflow-hidden`}>
        {items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Sua lista de compras está vazia.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map(item => (
              <li key={item.id} className={`flex items-center gap-3 p-4 transition-colors ${item.completed ? 'bg-gray-50' : `${theme.hoverLight}/50`}`}>
                <button onClick={() => toggleItem(item.id, !item.completed)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${item.completed ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}>
                  {item.completed && <CheckCircle2 className="w-4 h-4" />}
                </button>
                <span className={`flex-1 text-lg ${item.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {item.name} {item.quantity && item.unit && <span className="text-sm font-medium text-gray-500">({item.quantity} {item.unit})</span>}
                </span>
                <button onClick={() => deleteItem(item.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
                  <Trash2 className="w-5 h-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Promotions({ store }: { store: any }) {
  const theme = THEMES[(store?.theme as keyof typeof THEMES) || 'orange'];
  const [promotions, setPromotions] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingPromo, setEditingPromo] = useState<any>(null);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!store?.id) return;
    
    const promosRef = collection(db, 'stores', store.id, 'promotions');
    const unsubscribe = onSnapshot(promosRef, (snapshot) => {
      const promosData = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      setPromotions(promosData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `stores/${store.id}/promotions`);
    });
    
    return () => unsubscribe();
  }, [store?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store?.id) return;
    
    try {
      const promoData = {
        name,
        description,
        discountType,
        discountValue: parseFloat(discountValue.replace(',', '.')),
        active,
        createdAt: editingPromo ? editingPromo.createdAt : new Date().toISOString()
      };

      if (editingPromo) {
        await updateDoc(doc(db, 'stores', store.id, 'promotions', editingPromo.id), promoData);
      } else {
        await addDoc(collection(db, 'stores', store.id, 'promotions'), promoData);
      }
      
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingPromo ? OperationType.UPDATE : OperationType.CREATE, `stores/${store.id}/promotions`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!store?.id) return;
    if (window.confirm('Tem certeza que deseja excluir esta promoção?')) {
      try {
        await deleteDoc(doc(db, 'stores', store.id, 'promotions', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `stores/${store.id}/promotions/${id}`);
      }
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setDiscountType('percentage');
    setDiscountValue('');
    setActive(true);
    setIsAdding(false);
    setEditingPromo(null);
  };

  const editPromo = (promo: any) => {
    setName(promo.name);
    setDescription(promo.description || '');
    setDiscountType(promo.discountType);
    setDiscountValue(promo.discountValue.toString());
    setActive(promo.active);
    setEditingPromo(promo);
    setIsAdding(true);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Promoções</h1>
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} className={`${theme.primary} ${theme.hover} text-white px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 text-sm md:text-base`}>
            <Plus className="w-5 h-5" />
            Nova Promoção
          </button>
        )}
      </div>

      {isAdding && (
        <div className={`bg-white p-4 md:p-6 rounded-3xl shadow-sm mb-8 border ${theme.border}`}>
          <h2 className="text-xl font-bold text-gray-800 mb-4">{editingPromo ? 'Editar Promoção' : 'Nova Promoção'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Promoção</label>
              <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-opacity-50 outline-none" placeholder="Ex: Cupom de Primeira Compra" />
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Desconto</label>
                <select value={discountType} onChange={e => setDiscountType(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-opacity-50 outline-none bg-white">
                  <option value="percentage">Porcentagem (%)</option>
                  <option value="fixed">Valor Fixo (R$)</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor do Desconto</label>
                <input required type="number" step="0.01" min="0" value={discountValue} onChange={e => setDiscountValue(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-opacity-50 outline-none" placeholder={discountType === 'percentage' ? "Ex: 10" : "Ex: 5.00"} />
              </div>
              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className={`w-5 h-5 ${theme.text} rounded focus:ring-opacity-50`} />
                  <span className="text-gray-700 font-medium">Ativa</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (opcional)</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-opacity-50 outline-none resize-none" rows={2} placeholder="Ex: Válido para compras acima de R$ 50" />
            </div>
            
            <div className="flex gap-3 pt-4">
              <button type="submit" className={`flex-1 md:flex-none ${theme.primary} ${theme.hover} text-white px-6 py-3 rounded-xl font-medium transition-colors`}>
                {editingPromo ? 'Salvar' : 'Adicionar'}
              </button>
              <button type="button" onClick={resetForm} className="flex-1 md:flex-none bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-medium transition-colors">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {promotions.map(promo => (
          <div key={promo.id} className={`bg-white p-4 md:p-5 rounded-3xl shadow-sm border flex flex-col gap-2 ${promo.active ? `${theme.border}` : 'border-gray-200 opacity-75'}`}>
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-bold text-gray-800 leading-tight flex items-center gap-2">
                <Tag className={`w-5 h-5 ${theme.text}`} />
                {promo.name}
              </h3>
              <span className={`font-bold ${theme.text} whitespace-nowrap ml-2 ${theme.light} px-2 py-1 rounded-lg`}>
                {promo.discountType === 'percentage' ? `${promo.discountValue}% OFF` : `R$ ${promo.discountValue.toFixed(2).replace('.', ',')} OFF`}
              </span>
            </div>
            {promo.description && <p className="text-gray-500 text-sm">{promo.description}</p>}
            
            <div className="mt-auto flex justify-between items-center pt-4 border-t border-gray-50">
              <span className={`text-xs font-medium px-2 py-1 rounded-md ${promo.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {promo.active ? 'Ativa' : 'Inativa'}
              </span>
              <div className="flex gap-1">
                <button onClick={() => editPromo(promo)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                  <Edit2 className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <button onClick={() => handleDelete(promo.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {promotions.length === 0 && !isAdding && (
          <div className="text-center py-12 col-span-full">
            <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhuma promoção cadastrada.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsPage({ store }: { store: any }) {
  const currentTheme = THEMES[(store?.theme as keyof typeof THEMES) || 'orange'];
  const [name, setName] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [theme, setTheme] = useState('orange');
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState('');
  const [pickupEnabled, setPickupEnabled] = useState(false);
  const [pickupAddress, setPickupAddress] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (store) {
      setName(store.name || '');
      setPixKey(store.pixKey || '');
      setPhone(store.phone || '');
      setAvatarUrl(store.avatarUrl || '');
      setTheme(store.theme || 'orange');
      setDeliveryEnabled(store.deliveryEnabled || false);
      setDeliveryFee(store.deliveryFee?.toString() || '');
      setPickupEnabled(store.pickupEnabled || false);
      setPickupAddress(store.pickupAddress || '');
    }
  }, [store]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await compressImage(file);
        setAvatarUrl(base64);
      } catch (err) {
        console.error("Error compressing image", err);
        alert("Erro ao processar imagem. Tente uma imagem menor.");
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store?.id) return;
    
    try {
      await updateDoc(doc(db, 'stores', store.id), {
        name,
        pixKey,
        phone,
        avatarUrl,
        theme,
        deliveryEnabled,
        deliveryFee: deliveryFee ? parseFloat(deliveryFee.replace(',', '.')) : 0,
        pickupEnabled,
        pickupAddress
      });
      alert('Configurações salvas com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stores/${store.id}`);
    }
  };

  const baseUrl = process.env.APP_URL || window.location.origin;
  const storeUrl = `${baseUrl}/loja/${store?.id}`;

  const copyLink = () => {
    navigator.clipboard.writeText(storeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 md:mb-8">Configurações</h1>
      
      <div className={`bg-white p-4 md:p-6 rounded-3xl shadow-sm mb-6 md:mb-8 border ${currentTheme.border}`}>
        <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Share2 className={`w-5 h-5 ${currentTheme.text}`} />
          Link da sua Loja
        </h2>
        <p className="text-sm md:text-base text-gray-600 mb-4">Compartilhe este link com seus clientes para que eles possam fazer pedidos.</p>
        
        <div className={`flex flex-col md:flex-row items-stretch md:items-center gap-2 ${currentTheme.light} p-2 md:p-3 rounded-xl`}>
          <input type="text" readOnly value={storeUrl} className="flex-1 bg-transparent border-none outline-none text-gray-700 font-medium text-sm md:text-base p-2" />
          <button onClick={copyLink} className={`${currentTheme.primary} ${currentTheme.hover} text-white p-3 md:p-2 rounded-lg transition-colors flex items-center justify-center gap-2`}>
            {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>

      <div className={`bg-white p-4 md:p-6 rounded-3xl shadow-sm border ${currentTheme.border}`}>
        <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-6">Dados da Loja</h2>
        <form onSubmit={handleSave} className="space-y-5">
          
          <div className="flex flex-col items-center mb-6">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden relative border-2 border-dashed border-gray-300 mb-2">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-8 h-8 text-gray-400" />
              )}
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
            <span className="text-sm text-gray-500">Logo da Loja (Toque para alterar)</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Loja</label>
            <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-opacity-50 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chave PIX (para pagamentos)</label>
            <input type="text" value={pixKey} onChange={e => setPixKey(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-opacity-50 outline-none" placeholder="CPF, E-mail, Telefone ou Chave Aleatória" />
            <p className="text-xs text-gray-500 mt-1">O PIX automático requer integração bancária. Por enquanto, o app mostra sua chave para o cliente pagar manualmente.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone (WhatsApp)</label>
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-opacity-50 outline-none" placeholder="(00) 00000-0000" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cor do Tema da Loja</label>
            <div className="flex gap-3">
              {Object.keys(THEMES).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`w-10 h-10 rounded-full transition-transform ${THEMES[t as keyof typeof THEMES].primary} ${theme === t ? 'ring-4 ring-offset-2 ring-gray-300 scale-110' : 'hover:scale-110'}`}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6 mt-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Truck className={`w-5 h-5 ${currentTheme.text}`} />
              Opções de Entrega
            </h3>
            
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <label className="flex items-center gap-3 cursor-pointer mb-3">
                  <input type="checkbox" checked={deliveryEnabled} onChange={e => setDeliveryEnabled(e.target.checked)} className={`w-5 h-5 ${currentTheme.text} rounded focus:ring-opacity-50`} />
                  <span className="text-gray-800 font-medium">Habilitar Entrega</span>
                </label>
                {deliveryEnabled && (
                  <div className="pl-8">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Taxa de Entrega (R$)</label>
                    <input type="number" step="0.01" min="0" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-opacity-50 outline-none" placeholder="Ex: 5.00" />
                  </div>
                )}
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <label className="flex items-center gap-3 cursor-pointer mb-3">
                  <input type="checkbox" checked={pickupEnabled} onChange={e => setPickupEnabled(e.target.checked)} className={`w-5 h-5 ${currentTheme.text} rounded focus:ring-opacity-50`} />
                  <span className="text-gray-800 font-medium">Habilitar Retirada no Local</span>
                </label>
                {pickupEnabled && (
                  <div className="pl-8">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Endereço para Retirada</label>
                    <textarea value={pickupAddress} onChange={e => setPickupAddress(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-opacity-50 outline-none resize-none" rows={2} placeholder="Ex: Rua das Flores, 123 - Centro" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button type="submit" className={`w-full ${currentTheme.primary} ${currentTheme.hover} text-white px-6 py-4 rounded-xl font-bold transition-colors text-lg`}>
              Salvar Configurações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
