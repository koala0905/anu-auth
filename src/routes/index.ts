import { Router } from "express";
import interactionRoute from "#/routes/interaction/index.js";

const route = Router();

route.use("/interaction", interactionRoute);

export default route;
