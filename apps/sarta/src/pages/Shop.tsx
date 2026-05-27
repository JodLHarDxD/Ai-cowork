import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ProductCard } from "../components/ProductCard";
import { categories, products } from "../data/products";
import "./Shop.css";

const sorts = [
  { id: "featured", label: "Featured" },
  { id: "price-asc", label: "Price: Low to High" },
  { id: "price-desc", label: "Price: High to Low" },
  { id: "name", label: "Name A-Z" },
] as const;

type SortId = (typeof sorts)[number]["id"];

export function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") ?? "all";
  const [sort, setSort] = useState<SortId>("featured");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = [...products];

    if (category !== "all") {
      if (category === "new") {
        list = list.filter((product) => product.category === "new" || product.tag === "New");
      } else {
        list = list.filter((product) => product.category === category);
      }
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (product) =>
          product.name.toLowerCase().includes(q) ||
          product.category.toLowerCase().includes(q) ||
          product.subCategory?.toLowerCase().includes(q),
      );
    }

    switch (sort) {
      case "price-asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "name":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        break;
    }

    return list;
  }, [category, sort, query]);

  const currentCategory = categories.find((cat) => cat.id === category)?.label ?? "All";

  return (
    <main className="shop page page-enter">
      {/* Visually hidden page title for AT landmark navigation */}
      <h1 className="sr-only">Shop — {currentCategory}</h1>
      <section className="shop-topline" aria-label="Shop controls">
        <button
          type="button"
          className="shop-filter-trigger"
          aria-expanded={filtersOpen}
          aria-controls="shop-filter-panel"
          onClick={() => setFiltersOpen((value) => !value)}
        >
          Filters
        </button>
        <p className="shop-count">
          {filtered.length} products / {currentCategory}
        </p>
        <label className="shop-sort">
          <span>Sort by</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortId)}>
            {sorts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section
        id="shop-filter-panel"
        className={`shop-filter-panel ${filtersOpen ? "is-open" : ""}`}
        {...(!filtersOpen && { inert: true })}
      >
        <nav className="shop-categories" aria-label="Product categories">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={category === cat.id ? "is-active" : ""}
              onClick={() => {
                setSearchParams(cat.id === "all" ? {} : { category: cat.id });
                setFiltersOpen(false);
              }}
            >
              {cat.label}
            </button>
          ))}
        </nav>

        <label className="shop-search">
          <span className="sr-only">Search products</span>
          <input
            type="search"
            placeholder="Search products"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </section>

      {filtered.length === 0 ? (
        <p className="shop-empty">No products match your filters.</p>
      ) : (
        <section className="shop-grid" aria-label="Products">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </section>
      )}
    </main>
  );
}
