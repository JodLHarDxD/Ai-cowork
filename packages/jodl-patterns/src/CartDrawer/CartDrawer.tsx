import React from "react";
import "./CartDrawer.css";

export interface CartDrawerItem {
  product: {
    id: string | number;
    name: string;
    price: number;
    image: string;
    [key: string]: any;
  };
  size: string;
  color: string;
  quantity: number;
}

export interface CartDrawerProps {
  isOpen: boolean;
  items: CartDrawerItem[];
  subtotal: number;
  onClose: () => void;
  onRemoveItem: (id: string | number, size: string, color: string) => void;
  onUpdateQuantity: (id: string | number, size: string, color: string, quantity: number) => void;
  formatPrice?: (price: number) => string;
  checkoutPath?: string;
  cartPath?: string;
  shopPath?: string;
  linkComponent?: React.ComponentType<any> | string;
}

export function CartDrawer({
  isOpen,
  items,
  subtotal,
  onClose,
  onRemoveItem,
  onUpdateQuantity,
  formatPrice = (p) => `$${p.toFixed(2)}`,
  checkoutPath = "/checkout",
  cartPath = "/cart",
  shopPath = "/shop",
  linkComponent = "a",
}: CartDrawerProps) {
  if (!isOpen) return null;

  const LinkTag = linkComponent;
  const isCustomLink = typeof LinkTag !== "string";

  const getLinkProps = (to: string) => {
    return isCustomLink ? { to } : { href: to };
  };

  return (
    <>
      <button
        type="button"
        className="cart-drawer__backdrop"
        aria-label="Close bag"
        onClick={onClose}
      />
      <aside className="cart-drawer" aria-label="Shopping bag">
        <header className="cart-drawer__head">
          <h2>Bag ({String(items.length).padStart(2, "0")})</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>

        <div className="cart-drawer__body">
          {items.length === 0 ? (
            <p className="cart-drawer__empty">
              Your bag is empty.{" "}
              <LinkTag {...(getLinkProps(shopPath) as any)} onClick={onClose}>
                Continue shopping
              </LinkTag>
            </p>
          ) : (
            <ul className="cart-drawer__list">
              {items.map((item) => (
                <li
                  key={`${item.product.id}-${item.size}-${item.color}`}
                  className="cart-drawer__item"
                >
                  <img src={item.product.image} alt={item.product.name} />
                  <div>
                    <p className="cart-drawer__name">{item.product.name}</p>
                    <p className="cart-drawer__variant">
                      {item.color} · {item.size}
                    </p>
                    <div className="cart-drawer__qty">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateQuantity(
                            item.product.id,
                            item.size,
                            item.color,
                            item.quantity - 1,
                          )
                        }
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateQuantity(
                            item.product.id,
                            item.size,
                            item.color,
                            item.quantity + 1,
                          )
                        }
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="cart-drawer__remove"
                      onClick={() =>
                        onRemoveItem(item.product.id, item.size, item.color)
                      }
                    >
                      Remove
                    </button>
                  </div>
                  <p>{formatPrice(item.product.price * item.quantity)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="cart-drawer__foot">
          <div className="cart-drawer__row">
            <span>Subtotal</span>
            <strong>{formatPrice(subtotal)}</strong>
          </div>
          <p className="cart-drawer__note">
            Shipping and taxes calculated at checkout.
          </p>
          <LinkTag
            {...(getLinkProps(checkoutPath) as any)}
            className="btn btn--primary cart-drawer__checkout"
            onClick={onClose}
          >
            Checkout
          </LinkTag>
          <LinkTag
            {...(getLinkProps(cartPath) as any)}
            className="cart-drawer__view"
            onClick={onClose}
          >
            View full bag
          </LinkTag>
        </footer>
      </aside>
    </>
  );
}
