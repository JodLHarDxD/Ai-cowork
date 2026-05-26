import React, { useState } from "react";
import "./ProductCard.css";

export interface Product {
  id: string | number;
  name: string;
  slug: string;
  price: number;
  image: string;
  hoverImage?: string;
  tag?: string;
  [key: string]: any;
}

export interface ProductCardProps {
  product: Product;
  layout?: "grid" | "editorial";
  formatPrice?: (price: number) => string;
  linkComponent?: React.ComponentType<any> | string;
}

export function ProductCard({
  product,
  layout = "grid",
  formatPrice = (p) => `$${p.toFixed(2)}`,
  linkComponent = "a",
}: ProductCardProps) {
  const [hover, setHover] = useState(false);
  const LinkTag = linkComponent;

  const isCustomLink = typeof LinkTag !== "string";
  const linkProps = isCustomLink
    ? { to: `/product/${product.slug}` }
    : { href: `/product/${product.slug}` };

  return (
    <article
      className={`product-card product-card--${layout}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <LinkTag {...(linkProps as any)} className="product-card__media">
        {product.tag && <span className="product-card__tag">{product.tag}</span>}
        <img
          src={product.image}
          alt={product.name}
          className="product-card__img"
          loading="lazy"
        />
        {product.hoverImage && (
          <img
            src={product.hoverImage}
            alt=""
            className={`product-card__img product-card__img--hover ${hover ? "is-visible" : ""}`}
            loading="lazy"
          />
        )}
      </LinkTag>
      <div className="product-card__meta">
        <LinkTag {...(linkProps as any)}>
          <h3>{product.name}</h3>
        </LinkTag>
        <p>{formatPrice(product.price)}</p>
      </div>
    </article>
  );
}
