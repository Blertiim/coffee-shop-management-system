import { useMemo, useState } from "react";

const buildCartItem = (product) => ({
  productId: product.id,
  name: product.name,
  price: product.price,
  quantity: 1,
});

export default function useOrderCart() {
  const [cart, setCart] = useState([]);

  const addProduct = (product) => {
    setCart((current) => {
      const existingItem = current.find((item) => item.productId === product.id);

      if (!existingItem) {
        return [...current, buildCartItem(product)];
      }

      return current.map((item) =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    });
  };

  const changeQuantity = (productId, delta) => {
    setCart((current) =>
      current
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeProduct = (productId) => {
    setCart((current) => current.filter((item) => item.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const total = useMemo(
    () =>
      Number(
        cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)
      ),
    [cart]
  );

  const itemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  return {
    cart,
    setCart,
    total,
    itemCount,
    addProduct,
    changeQuantity,
    removeProduct,
    clearCart,
  };
}
