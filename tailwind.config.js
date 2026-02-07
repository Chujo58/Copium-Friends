/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{js,jsx,ts,tsx,html}"],
    theme: {
        extend: {
            fontFamily: {
                card: ["Chubbo", "Zilla Slab", "ui-sans-serif", "system-ui"],
                sans: ["Zilla Slab", "Lusitana", "Rubik", "ui-sans-serif", "system-ui"],
                body: ["Quicksand", "ui-sans-serif", "system-ui"],
            },
            colors: {
                rose: {
                    copper: "#A86A65", // Copper Rose
                    dusty: "#AB8882", // Dusty Rose
                    water: "#D8A694", // Rosewater
                    china: "#E0CBB9", // China Doll
                    plum: "#754B4D", // Plum Wine
                },

                // Optional semantic aliases (recommended)
                primary: "#A86A65",
                secondary: "#AB8882",
                accent: "#D8A694",
                surface: "#E0CBB9",
                dark: "#754B4D",
            },
        },
    },
    plugins: [],
};
