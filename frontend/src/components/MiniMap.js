import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pin = (color) => L.divIcon({
  className: "",
  html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:4px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.3)"></div>`,
  iconSize: [24, 24], iconAnchor: [12, 12],
});

export const MiniMap = ({ lat, lng, mode = "marker", onPick, zoom = 15, testId }) => {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    const map = L.map(boxRef.current, { scrollWheelZoom: false, attributionControl: false })
      .setView([lat, lng], zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    if (mode === "pick") map.on("click", (e) => pickRef.current?.(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 200);
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    layerRef.current = mode === "circle"
      ? L.circle([lat, lng], { radius: 150, color: "#2C5545", fillColor: "#2C5545", fillOpacity: 0.18 })
      : L.marker([lat, lng], { icon: pin(mode === "pick" ? "#E06D53" : "#2C5545") });
    layerRef.current.addTo(map);
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, mode]);

  return <div ref={boxRef} data-testid={testId} style={{ height: "100%", width: "100%" }} />;
};
