import {
    createBrowserRouter,
    RouterProvider
} from "react-router-dom";

import Landing from "./pages/landing";
import Dashboard from "./pages/dashboard";
import ChooseCat1 from "./pages/choosecat1";
import ChooseCat2 from "./pages/choosecat2";
import ChooseCat3 from "./pages/choosecat3";
import Session from "./pages/session";

const router = createBrowserRouter([
    { path: "/", element: <Landing /> },
    { path: "/dashboard", element: <Dashboard /> },
    { path: "/choosecat1", element: <ChooseCat1 /> },
    { path: "/choosecat2", element: <ChooseCat2 /> },
    { path: "/choosecat3", element: <ChooseCat3 /> },
    { path: "/session", element: <Session /> },
]);

export default function App() {
  // 2. Use RouterProvider instead of <Router><Routes>...
  return <RouterProvider router={router} />;
}