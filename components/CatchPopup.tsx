import { useFishing } from "@/lib/stores/useFishing";
import { motion, AnimatePresence } from "framer-motion";

interface CatchPopupProps {
  onClose: () => void;
}

export function CatchPopup({ onClose }: CatchPopupProps) {
  const { caughtFish, caughtFishSize } = useFishing();

  if (!caughtFish) return null;

  const rarityColors = {
    common: { bg: "bg-gray-100", text: "text-gray-600", label: "Gewöhnlich" },
    uncommon: { bg: "bg-blue-100", text: "text-blue-600", label: "Ungewöhnlich" },
    rare: { bg: "bg-purple-100", text: "text-purple-600", label: "Selten" },
  };

  const rarity = rarityColors[caughtFish.rarity];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 flex items-center justify-center z-50"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl 
                     p-8 mx-4 max-w-sm w-full border border-gray-200/50"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center
                     rounded-full bg-gray-100 hover:bg-gray-200 transition-colors
                     text-gray-500 hover:text-gray-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", damping: 15 }}
              className="mb-6"
            >
              <div
                className="w-32 h-32 mx-auto rounded-full flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${caughtFish.color.replace("0.4", "0.6")}, ${caughtFish.color.replace("0.4", "0.3")})`,
                }}
              >
                <svg
                  viewBox="0 0 100 60"
                  className="w-24 h-16"
                  style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.1))" }}
                >
                  <ellipse cx="50" cy="30" rx="35" ry="20" fill={caughtFish.color.replace("0.4", "0.8")} />
                  <path
                    d="M15 30 L-5 15 L-5 45 Z"
                    fill={caughtFish.color.replace("0.4", "0.8")}
                  />
                  <circle cx="70" cy="25" r="4" fill="rgba(255,255,255,0.6)" />
                </svg>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <p className="text-gray-500 text-sm mb-2 font-medium">Gefangen!</p>
              <h2 className="text-3xl font-semibold text-gray-800 mb-3">
                {caughtFish.name}
              </h2>
              <div
                className={`inline-block px-4 py-1.5 rounded-full text-sm font-medium ${rarity.bg} ${rarity.text}`}
              >
                {rarity.label}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6 grid grid-cols-2 gap-4"
            >
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-gray-400 text-xs mb-1">Größe</p>
                <p className="text-gray-700 font-medium">
                  {caughtFishSize || Math.round(caughtFish.size)} cm
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-gray-400 text-xs mb-1">Geschwindigkeit</p>
                <p className="text-gray-700 font-medium">
                  {caughtFish.speed < 0.8 ? "Langsam" : caughtFish.speed < 1.2 ? "Mittel" : "Schnell"}
                </p>
              </div>
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              onClick={onClose}
              className="mt-6 w-full py-3 bg-gray-900 text-white rounded-xl font-medium
                       transition-all duration-300 hover:bg-gray-800 active:scale-98"
            >
              Weiter angeln
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
