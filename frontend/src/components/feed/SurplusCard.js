import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Package, BowlFood, Carrot, Truck, Handshake, Scales } from "@phosphor-icons/react";
import { Countdown } from "@/components/Countdown";
import { mediaUrl } from "@/lib/api";

const handoffMeta = {
  pickup: { label: "Ambil di donor", icon: Handshake },
  dropoff: { label: "Titik netral", icon: MapPin },
  delivery: { label: "Diantar donor", icon: Truck },
};

export const SurplusCard = ({ post, index = 0 }) => {
  const navigate = useNavigate();
  const H = handoffMeta[post.handoff] || handoffMeta.pickup;
  const cooked = post.category === "cooked";
  const dist = post.distance_m === null || post.distance_m === undefined
    ? null
    : post.distance_m < 1000 ? `${post.distance_m} m` : `${(post.distance_m / 1000).toFixed(1)} km`;

  return (
    <motion.button
      data-testid={`post-card-${post.id}`}
      onClick={() => navigate(`/post/${post.id}`)}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.06, 0.4), duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className="press flex h-full w-full flex-col overflow-hidden rounded-3xl border border-line bg-white text-left shadow-warm hover:shadow-warmlg"
    >
      <div className="relative h-44 w-full shrink-0 overflow-hidden bg-line md:h-48">
        <img src={mediaUrl(post.photo_url)} alt={post.title} className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink/85 to-transparent" />
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-ink">
          {cooked ? <BowlFood size={13} weight="fill" /> : <Carrot size={13} weight="fill" />}
          {cooked ? "Matang" : "Bahan"}
        </div>
        <div className="absolute right-3 top-3">
          <Countdown target={post.window_end} testId={`countdown-${post.id}`} />
        </div>
        <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center gap-3 text-white">
          {dist && <span className="flex items-center gap-1 text-xs font-bold"><MapPin size={14} weight="fill" />{dist}</span>}
          <span className="flex items-center gap-1 text-xs font-bold"><Package size={14} weight="fill" />{post.portions} {post.unit}</span>
          {post.weight_kg > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold"><Scales size={14} weight="fill" />±{post.weight_kg} kg</span>
          )}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-heading text-lg font-extrabold leading-tight tracking-tight text-ink">{post.title}</h3>
        {post.notes && <p className="mt-1 line-clamp-2 text-sm text-slate2">{post.notes}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-sand px-2.5 py-1 text-xs font-semibold text-forest">
            <H.icon size={14} weight="bold" /> {H.label}
          </span>
          <span className="text-xs font-semibold text-slate2">{post.donor?.name} · trust {post.donor?.trust_score}</span>
        </div>
        {post.auto_accept && (
          <span className="mt-2 inline-block rounded-full bg-leaf/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-forest">
            Terima otomatis
          </span>
        )}
      </div>
    </motion.button>
  );
};
