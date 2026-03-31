import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, getDoc, getDocs, addDoc, query, where } from 'firebase/firestore';
import { ShoppingCart, Plus, Minus, CheckCircle2, Copy, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { SacoleIcon } from '../components/SacoleIcon';
import { THEMES } from '../utils/helpers';

export default function PublicStore() {
  const { storeId } = useParams<{ storeId: string }>();
  const [store, setStore] = useState<any>(null);
  const [flavors, setFlavors] = useState<any[]>([]);
  const [cart, setCart] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);
  
  // Checkout state
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [orderComplete, setOrderComplete] = useState<any>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  useEffect(() => {
    const fetchStore = async () => {
      if (!storeId) return;
      try {
        const storeDoc = await getDoc(doc(db, 'stores', storeId));
        if (storeDoc.exists()) {
          setStore({ id: storeDoc.id, ...storeDoc.data() });
          
          // Fetch flavors
          const flavorsQuery = query(collection(db, 'stores', storeId, 'flavors'), where('available', '==', true));
          const flavorsSnap = await getDocs(flavorsQuery);
          setFlavors(flavorsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `stores/${storeId}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStore();
  }, [storeId]);

  const addToCart = (flavorId: string) => {
    setCart(prev => ({ ...prev, [flavorId]: (prev[flavorId] || 0) + 1 }));
  };

  const removeFromCart = (flavorId: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[flavorId] > 1) {
        newCart[flavorId] -= 1;
      } else {
        delete newCart[flavorId];
      }
      return newCart;
    });
  };

  const cartItems = Object.entries(cart).map(([id, quantity]) => {
    const flavor = flavors.find(f => f.id === id);
    return { ...flavor, quantity };
  }).filter(item => item.name);

  const totalAmount = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || cartItems.length === 0) return;
    
    try {
      const orderData = {
        customerName,
        customerPhone,
        items: cartItems.map(item => ({
          flavorId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        totalAmount,
        status: 'pending',
        paymentMethod,
        createdAt: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, 'stores', storeId, 'orders'), orderData);
      setOrderComplete({ id: docRef.id, ...orderData });
      setCart({});
      setIsCheckingOut(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `stores/${storeId}/orders`);
    }
  };

  const copyPixKey = () => {
    if (store?.pixKey) {
      navigator.clipboard.writeText(store?.pixKey);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-500"></div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full">
          <SacoleIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Loja não encontrada</h1>
          <p className="text-gray-500">Verifique se o link está correto.</p>
        </div>
      </div>
    );
  }

  const theme = THEMES[(store.theme as keyof typeof THEMES) || 'orange'];

  if (orderComplete) {
    return (
      <div className={`min-h-screen ${theme.light} p-4 md:p-8 flex flex-col items-center justify-center`}>
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-gray-100">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Pedido Recebido!</h1>
          <p className="text-gray-600 mb-8">Obrigado, {orderComplete.customerName}. Seu pedido foi enviado para a {store.name}.</p>
          
          {orderComplete.paymentMethod === 'pix' && store.pixKey && (
            <div className={`${theme.light} p-4 md:p-6 rounded-2xl mb-8`}>
              <h3 className="font-bold text-gray-800 mb-2">Pagamento via PIX</h3>
              <p className="text-sm text-gray-600 mb-4">Valor total: <strong className={`text-lg ${theme.text}`}>R$ {orderComplete.totalAmount.toFixed(2).replace('.', ',')}</strong></p>
              
              <div className="bg-white p-4 rounded-xl inline-block mb-4 shadow-sm">
                <QRCodeSVG value={store.pixKey} size={150} />
              </div>
              
              <p className="text-xs md:text-sm text-gray-500 mb-2">Ou copie a chave PIX abaixo:</p>
              <div className={`flex items-center gap-2 bg-white p-2 md:p-3 rounded-xl border ${theme.border}`}>
                <span className="flex-1 font-mono text-xs md:text-sm text-gray-800 truncate">{store.pixKey}</span>
                <button onClick={copyPixKey} className={`${theme.text} ${theme.light} p-2 rounded-lg`}>
                  {copiedPix ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}
          
          <button onClick={() => setOrderComplete(null)} className={`w-full ${theme.primary} ${theme.hover} text-white font-bold py-4 px-6 rounded-2xl transition-colors`}>
            Fazer novo pedido
          </button>
        </div>
      </div>
    );
  }

  if (isCheckingOut) {
    return (
      <div className={`min-h-screen ${theme.light} p-4 md:p-8`}>
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setIsCheckingOut(false)} className={`flex items-center gap-2 ${theme.text} font-medium mb-6 transition-colors`}>
            <ArrowLeft className="w-5 h-5" />
            Voltar para o cardápio
          </button>
          
          <div className={`bg-white p-6 md:p-8 rounded-3xl shadow-xl border ${theme.border}`}>
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
              <ShoppingCart className={`w-6 h-6 ${theme.text}`} />
              Finalizar Pedido
            </h2>
            
            <div className={`${theme.light} p-4 rounded-2xl mb-8`}>
              <h3 className="font-bold text-gray-800 mb-4">Resumo do Pedido</h3>
              <ul className="space-y-3 mb-4">
                {cartItems.map((item, i) => (
                  <li key={i} className="flex justify-between items-center text-gray-700">
                    <span><span className={`font-bold ${theme.text}`}>{item.quantity}x</span> {item.name}</span>
                    <span className="font-medium">R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                  </li>
                ))}
              </ul>
              <div className={`border-t ${theme.border} pt-4 flex justify-between items-center`}>
                <span className="font-bold text-gray-800">Total</span>
                <span className={`text-2xl font-bold ${theme.text}`}>R$ {totalAmount.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>
            
            <form onSubmit={handleCheckout} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seu Nome</label>
                <input required type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className={`w-full p-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-opacity-50 outline-none text-lg`} placeholder="Como devemos te chamar?" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp (opcional)</label>
                <input type="text" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className={`w-full p-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-opacity-50 outline-none text-lg`} placeholder="(00) 00000-0000" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Forma de Pagamento</label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`cursor-pointer border-2 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'pix' ? `${theme.border} ${theme.light}` : 'border-gray-200'}`}>
                    <input type="radio" name="payment" value="pix" checked={paymentMethod === 'pix'} onChange={() => setPaymentMethod('pix')} className="sr-only" />
                    <div className="w-8 h-8 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center font-bold">P</div>
                    <span className="font-medium text-gray-800">PIX</span>
                  </label>
                  <label className={`cursor-pointer border-2 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'cash' ? `${theme.border} ${theme.light}` : 'border-gray-200'}`}>
                    <input type="radio" name="payment" value="cash" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} className="sr-only" />
                    <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold">$</div>
                    <span className="font-medium text-gray-800">Dinheiro</span>
                  </label>
                </div>
              </div>
              
              <button type="submit" className={`w-full ${theme.primary} ${theme.hover} text-white font-bold py-4 px-6 rounded-2xl transition-colors text-lg mt-8 shadow-lg`}>
                Confirmar Pedido
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.light} pb-32`}>
      {/* Header */}
      <header className={`bg-gradient-to-r ${theme.gradient} text-white shadow-md sticky top-0 z-10 relative overflow-hidden`}>
        {/* Decorative background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="sacole-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M15 10l1.5-2h3L21 10 M14 10h8v14a4 4 0 0 1-8 0V10z M14 14h8 M14 18h8 M14 22h8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="url(#sacole-pattern)" />
          </svg>
        </div>
        
        <div className="max-w-4xl mx-auto p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 relative z-10 text-center md:text-left">
          <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-full flex items-center justify-center overflow-hidden shadow-xl flex-shrink-0 border-4 border-white/20">
            {store.avatarUrl ? (
              <img src={store.avatarUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <SacoleIcon className={`w-12 h-12 ${theme.text}`} />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-black mb-2 drop-shadow-sm">{store.name}</h1>
            <p className="text-white/90 text-lg font-medium">Escolha seus sabores favoritos e faça seu pedido!</p>
            
            {store.phone && (
              <div className="mt-4 inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                {store.phone}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Flavors Grid */}
      <main className="max-w-4xl mx-auto p-4 md:p-6">
        {flavors.length === 0 ? (
          <div className="text-center py-12">
            <SacoleIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-600">Nenhum sabor disponível no momento</h3>
            <p className="text-gray-400 mt-2">Volte mais tarde!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            {flavors.map(flavor => (
              <div key={flavor.id} className={`bg-white p-4 md:p-5 rounded-3xl shadow-sm border ${theme.border} flex flex-col h-full`}>
                <div className="flex gap-4 mb-4">
                  <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-100 rounded-2xl flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {flavor.imageUrl ? (
                      <img src={flavor.imageUrl} alt={flavor.name} className="w-full h-full object-cover" />
                    ) : (
                      <SacoleIcon className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg md:text-xl font-bold text-gray-800 leading-tight mb-1">{flavor.name}</h3>
                    <span className={`font-bold ${theme.text} ${theme.light} px-3 py-1 rounded-full inline-block text-sm`}>
                      R$ {flavor.price.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
                
                {flavor.description && <p className="text-gray-500 text-sm mb-6 flex-1">{flavor.description}</p>}
                
                <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                  {cart[flavor.id] ? (
                    <div className={`${theme.light} rounded-2xl p-1 w-full flex items-center justify-between`}>
                      <button onClick={() => removeFromCart(flavor.id)} className={`w-10 h-10 flex items-center justify-center bg-white ${theme.text} rounded-xl shadow-sm transition-colors`}>
                        <Minus className="w-5 h-5" />
                      </button>
                      <span className="font-bold text-lg text-gray-800">{cart[flavor.id]}</span>
                      <button onClick={() => addToCart(flavor.id)} className={`w-10 h-10 flex items-center justify-center ${theme.primary} text-white rounded-xl shadow-sm transition-colors`}>
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => addToCart(flavor.id)} className={`w-full ${theme.light} ${theme.text} font-bold py-3 px-4 rounded-2xl transition-colors flex items-center justify-center gap-2`}>
                      <Plus className="w-5 h-5" />
                      Adicionar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Cart Bar */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent z-20">
          <div className="max-w-4xl mx-auto">
            <button onClick={() => setIsCheckingOut(true)} className={`w-full ${theme.primary} text-white p-4 rounded-3xl shadow-xl flex items-center justify-between transition-transform hover:scale-[1.02] active:scale-95`}>
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl relative">
                  <ShoppingCart className="w-6 h-6" />
                  <span className={`absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 ${theme.border}`}>
                    {cartItems.reduce((acc, item) => acc + item.quantity, 0)}
                  </span>
                </div>
                <span className="font-bold text-lg">Ver Pedido</span>
              </div>
              <span className="font-bold text-xl">
                R$ {totalAmount.toFixed(2).replace('.', ',')}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
