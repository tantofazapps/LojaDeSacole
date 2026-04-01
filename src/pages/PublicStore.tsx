import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, query, where } from 'firebase/firestore';
import { ShoppingCart, Plus, Minus, CheckCircle2, Copy, ArrowLeft, Image as ImageIcon, Truck, MapPin, Tag } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { SacoleIcon } from '../components/SacoleIcon';
import { THEMES } from '../utils/helpers';

export default function PublicStore() {
  const { storeId } = useParams<{ storeId: string }>();
  const [store, setStore] = useState<any>(null);
  const [flavors, setFlavors] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [cart, setCart] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);
  
  // Checkout state
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [orderComplete, setOrderComplete] = useState<any>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchStore = async () => {
      if (!storeId) return;
      try {
        const storeDoc = await getDoc(doc(db, 'stores', storeId));
        if (storeDoc.exists()) {
          const storeData = { id: storeDoc.id, ...(storeDoc.data() as any) };
          setStore(storeData);
          
          // Set default delivery method based on what's enabled
          if (storeData.deliveryEnabled && !storeData.pickupEnabled) {
            setDeliveryMethod('delivery');
          } else if (storeData.pickupEnabled && !storeData.deliveryEnabled) {
            setDeliveryMethod('pickup');
          }
          
          // Fetch flavors
          const flavorsQuery = query(collection(db, 'stores', storeId, 'flavors'), where('available', '==', true));
          const flavorsSnap = await getDocs(flavorsQuery);
          setFlavors(flavorsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

          // Fetch active promotions
          const promosQuery = query(collection(db, 'stores', storeId, 'promotions'), where('active', '==', true));
          const promosSnap = await getDocs(promosQuery);
          setPromotions(promosSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `stores/${storeId}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStore();
  }, [storeId]);

  const addToCart = async (flavorId: string) => {
    const flavor = flavors.find(f => f.id === flavorId);
    if (!flavor) return;

    const currentQty = cart[flavorId] || 0;
    
    if (!flavor.allowPreorder && flavor.stock !== undefined && flavor.stock !== null) {
      if (currentQty >= flavor.stock) {
        alert(`Desculpe, temos apenas ${flavor.stock} unidade(s) de ${flavor.name} em estoque no momento.`);
        
        // Log demand alert for admin
        try {
          await addDoc(collection(db, 'stores', storeId!, 'demand_alerts'), {
            flavorId: flavor.id,
            flavorName: flavor.name,
            requestedQuantity: currentQty + 1,
            availableStock: flavor.stock,
            createdAt: new Date().toISOString()
          });
        } catch (e) {
          console.error("Error logging demand:", e);
        }
        return;
      }
    } else if (flavor.allowPreorder && flavor.maxPreorderQuantity !== undefined && flavor.maxPreorderQuantity !== null) {
      // If pre-order is allowed, check if there's a maximum quantity
      // The total allowed is stock + maxPreorderQuantity
      const totalAllowed = (flavor.stock || 0) + flavor.maxPreorderQuantity;
      if (currentQty >= totalAllowed) {
        alert(`Desculpe, o limite máximo de encomendas para ${flavor.name} é de ${flavor.maxPreorderQuantity} unidade(s).`);
        return;
      }
    }

    setCart(prev => ({ ...prev, [flavorId]: currentQty + 1 }));
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

  const subtotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  
  // Calculate discount
  let discount = 0;
  let appliedPromo = null;
  if (promotions.length > 0) {
    // Simple logic: apply the best promotion
    let bestDiscount = 0;
    promotions.forEach(promo => {
      let currentDiscount = 0;
      if (promo.discountType === 'percentage') {
        currentDiscount = subtotal * (promo.discountValue / 100);
      } else if (promo.discountType === 'fixed') {
        currentDiscount = promo.discountValue;
      }
      
      if (currentDiscount > bestDiscount && currentDiscount <= subtotal) {
        bestDiscount = currentDiscount;
        appliedPromo = promo;
      }
    });
    discount = bestDiscount;
  }

  const deliveryFee = deliveryMethod === 'delivery' && store?.deliveryEnabled ? (store.deliveryFee || 0) : 0;
  const totalAmount = subtotal - discount + deliveryFee;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || cartItems.length === 0) return;
    
    try {
      // Check stock again before finalizing
      for (const item of cartItems) {
        const flavorRef = doc(db, 'stores', storeId, 'flavors', item.id);
        const flavorSnap = await getDoc(flavorRef);
        if (flavorSnap.exists()) {
          const flavorData = flavorSnap.data();
          if (!flavorData.allowPreorder && flavorData.stock !== undefined && flavorData.stock !== null) {
            if (item.quantity > flavorData.stock) {
              alert(`Desculpe, o estoque de ${item.name} acabou de mudar. Temos apenas ${flavorData.stock} unidade(s) disponíveis.`);
              return;
            }
          } else if (flavorData.allowPreorder && flavorData.maxPreorderQuantity !== undefined && flavorData.maxPreorderQuantity !== null) {
            const totalAllowed = (flavorData.stock || 0) + flavorData.maxPreorderQuantity;
            if (item.quantity > totalAllowed) {
              alert(`Desculpe, o limite máximo de encomendas para ${item.name} é de ${flavorData.maxPreorderQuantity} unidade(s).`);
              return;
            }
          }
        }
      }

      const orderData = {
        customerName,
        customerPhone,
        deliveryMethod: store.deliveryEnabled || store.pickupEnabled ? deliveryMethod : null,
        deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress : null,
        deliveryFee,
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
      console.log("Order saved successfully:", docRef.id);

      // Decrement stock
      for (const item of cartItems) {
        const flavorRef = doc(db, 'stores', storeId, 'flavors', item.id);
        const flavorSnap = await getDoc(flavorRef);
        if (flavorSnap.exists()) {
          const flavorData = flavorSnap.data();
          if (flavorData.stock !== undefined && flavorData.stock !== null) {
            await updateDoc(flavorRef, {
              stock: Math.max(0, flavorData.stock - item.quantity)
            });
          }
        }
      }

      setOrderComplete({ id: docRef.id, ...orderData });
      setCart({});
      setIsCheckingOut(false);
    } catch (error) {
      console.error("Error saving order:", error);
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
              
              <div className="space-y-2 mb-4 pt-4 border-t border-gray-200/50">
                <div className="flex justify-between items-center text-gray-600 text-sm">
                  <span>Subtotal</span>
                  <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                </div>
                
                {appliedPromo && (
                  <div className="flex justify-between items-center text-green-600 text-sm font-medium">
                    <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> {appliedPromo.name}</span>
                    <span>- R$ {discount.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
                
                {deliveryMethod === 'delivery' && store?.deliveryEnabled && (
                  <div className="flex justify-between items-center text-gray-600 text-sm">
                    <span>Taxa de Entrega</span>
                    <span>R$ {deliveryFee.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
              </div>

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

              {(store.deliveryEnabled || store.pickupEnabled) && (
                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Opções de Entrega</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    {store.deliveryEnabled && (
                      <label className={`cursor-pointer border-2 rounded-2xl p-4 flex items-center gap-3 transition-all ${deliveryMethod === 'delivery' ? `${theme.border} ${theme.light}` : 'border-gray-200'}`}>
                        <input type="radio" name="delivery" value="delivery" checked={deliveryMethod === 'delivery'} onChange={() => setDeliveryMethod('delivery')} className="sr-only" />
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${deliveryMethod === 'delivery' ? `${theme.primary} text-white` : 'bg-gray-100 text-gray-500'}`}>
                          <Truck className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="font-bold text-gray-800 block">Receber em Casa</span>
                          <span className="text-xs text-gray-500">Taxa: R$ {store.deliveryFee?.toFixed(2).replace('.', ',') || '0,00'}</span>
                        </div>
                      </label>
                    )}
                    
                    {store.pickupEnabled && (
                      <label className={`cursor-pointer border-2 rounded-2xl p-4 flex items-center gap-3 transition-all ${deliveryMethod === 'pickup' ? `${theme.border} ${theme.light}` : 'border-gray-200'}`}>
                        <input type="radio" name="delivery" value="pickup" checked={deliveryMethod === 'pickup'} onChange={() => setDeliveryMethod('pickup')} className="sr-only" />
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${deliveryMethod === 'pickup' ? `${theme.primary} text-white` : 'bg-gray-100 text-gray-500'}`}>
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="font-bold text-gray-800 block">Retirar no Local</span>
                          <span className="text-xs text-gray-500">Grátis</span>
                        </div>
                      </label>
                    )}
                  </div>

                  {deliveryMethod === 'delivery' && store.deliveryEnabled && (
                    <div className="animate-in fade-in slide-in-from-top-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Endereço de Entrega</label>
                      <textarea required value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} className={`w-full p-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-opacity-50 outline-none resize-none`} rows={3} placeholder="Rua, Número, Bairro, Complemento..." />
                    </div>
                  )}

                  {deliveryMethod === 'pickup' && store.pickupEnabled && store.pickupAddress && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 animate-in fade-in slide-in-from-top-2">
                      <p className="text-sm font-medium text-gray-700 mb-1">Endereço para Retirada:</p>
                      <p className="text-gray-600">{store.pickupAddress}</p>
                    </div>
                  )}
                </div>
              )}
              
              <div className="pt-4 border-t border-gray-100">
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

  const groupedFlavors = flavors.reduce((acc, flavor) => {
    const category = flavor.category || 'Sacolé';
    if (!acc[category]) acc[category] = [];
    acc[category].push(flavor);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className={`min-h-screen ${theme.light} pb-32`}>
      {/* Header */}
      <header className={`bg-gradient-to-r ${theme.gradient} text-white shadow-md fixed top-0 left-0 right-0 z-20 overflow-hidden transition-all duration-300`}>
        {/* Decorative background pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
          <svg className="w-full h-[500px]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="sacole-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M15 10l1.5-2h3L21 10 M14 10h8v14a4 4 0 0 1-8 0V10z M14 14h8 M14 18h8 M14 22h8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="url(#sacole-pattern)" />
          </svg>
        </div>
        
        <div className={`max-w-4xl mx-auto px-4 md:px-8 relative z-10 flex items-center transition-all duration-300 ${isScrolled ? 'py-3 gap-3 md:gap-4' : 'py-6 md:py-8 flex-col md:flex-row gap-4 md:gap-6 text-center md:text-left'}`}>
          <div className={`bg-white rounded-full flex items-center justify-center overflow-hidden shadow-xl flex-shrink-0 border-4 border-white/20 transition-all duration-300 ${isScrolled ? 'w-12 h-12 md:w-14 md:h-14 border-2' : 'w-24 h-24 md:w-32 md:h-32'}`}>
            {store.avatarUrl ? (
              <img src={store.avatarUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <SacoleIcon className={`${theme.text} transition-all duration-300 ${isScrolled ? 'w-6 h-6' : 'w-12 h-12'}`} />
            )}
          </div>
          
          <div className={`flex-1 flex transition-all duration-300 ${isScrolled ? 'flex-row items-center justify-between gap-2' : 'flex-col items-center md:items-start'}`}>
            <div className={`${isScrolled ? 'text-left flex-1 min-w-0' : 'w-full'}`}>
              <h1 className={`font-black drop-shadow-sm transition-all duration-300 truncate ${isScrolled ? 'text-xl md:text-2xl mb-0' : 'text-3xl md:text-4xl mb-2'}`}>
                {store.name}
              </h1>
              
              <div className={`transition-all duration-300 overflow-hidden ${isScrolled ? 'max-h-0 opacity-0' : 'max-h-20 opacity-100'}`}>
                <p className="text-white/90 text-lg font-medium">Escolha seus produtos favoritos e faça seu pedido!</p>
              </div>
            </div>
            
            {store.phone && (
              <a 
                href={`https://wa.me/${store.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex-shrink-0 inline-flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 rounded-full font-medium backdrop-blur-sm transition-all duration-300 ${isScrolled ? 'w-10 h-10 p-0' : 'mt-4 px-6 py-3 text-sm'}`}
                title="Falar no WhatsApp"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className={`${isScrolled ? 'w-5 h-5' : 'w-5 h-5'}`}>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isScrolled ? 'max-w-0 opacity-0' : 'max-w-[200px] opacity-100'}`}>
                  Falar no WhatsApp
                </span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Flavors Grid */}
      <main className="max-w-4xl mx-auto p-4 md:p-6 pt-[380px] md:pt-[250px]">
        {flavors.length === 0 ? (
          <div className="text-center py-12">
            <SacoleIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-600">Nenhum produto disponível no momento</h3>
            <p className="text-gray-400 mt-2">Volte mais tarde!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedFlavors).map(([category, categoryFlavors]) => (
              <div key={category}>
                <h2 className={`text-2xl font-bold text-gray-800 mb-4 pl-2 border-l-4 ${theme.border}`}>{category}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  {(categoryFlavors as any[]).map(flavor => (
                    <div key={flavor.id} className={`bg-white p-4 md:p-5 rounded-3xl shadow-sm border ${theme.border} flex flex-col h-full ${flavor.stock <= 0 && !flavor.allowPreorder ? 'opacity-75 grayscale-[0.5]' : ''}`}>
                      <div className="flex gap-4 mb-4">
                        <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-100 rounded-2xl flex-shrink-0 overflow-hidden flex items-center justify-center relative">
                          {flavor.imageUrl ? (
                            <img src={flavor.imageUrl} alt={flavor.name} className="w-full h-full object-cover" />
                          ) : (
                            <SacoleIcon className="w-8 h-8 text-gray-300" />
                          )}
                          {flavor.stock <= 0 && !flavor.allowPreorder && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <span className="text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-red-500 rounded-md transform -rotate-12">Esgotado</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg md:text-xl font-bold text-gray-800 leading-tight mb-1">{flavor.name}</h3>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`font-bold ${theme.text} ${theme.light} px-3 py-1 rounded-full inline-block text-sm`}>
                              R$ {flavor.price.toFixed(2).replace('.', ',')}
                            </span>
                            {flavor.stock <= 0 && flavor.allowPreorder && (
                              <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-md">
                                Sob Encomenda
                              </span>
                            )}
                          </div>
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
                            <button 
                              onClick={() => addToCart(flavor.id)} 
                              disabled={(!flavor.allowPreorder && flavor.stock !== undefined && flavor.stock !== null && cart[flavor.id] >= flavor.stock) || (flavor.allowPreorder && flavor.maxPreorderQuantity !== undefined && flavor.maxPreorderQuantity !== null && cart[flavor.id] >= (flavor.stock || 0) + flavor.maxPreorderQuantity)}
                              className={`w-10 h-10 flex items-center justify-center ${theme.primary} text-white rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => addToCart(flavor.id)} 
                            disabled={flavor.stock <= 0 && !flavor.allowPreorder}
                            className={`w-full ${flavor.stock <= 0 && !flavor.allowPreorder ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : `${theme.light} ${theme.text}`} font-bold py-3 px-4 rounded-2xl transition-colors flex items-center justify-center gap-2`}
                          >
                            {flavor.stock <= 0 && !flavor.allowPreorder ? (
                              'Esgotado'
                            ) : (
                              <>
                                <Plus className="w-5 h-5" />
                                Adicionar
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
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
