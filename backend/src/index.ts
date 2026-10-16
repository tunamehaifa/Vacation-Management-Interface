import { loadEnv } from "commoneventframework";

const envReady = loadEnv();

import "./generated/HandlerRegistry";

import {
	APIGatewayProxyStructuredResultV2,
	Context,
	buildCommonEvent,
	getRouteConfig,
	resolveHandlerRef,
	Response,
	setLambdaContext,
	startDevServer
} from "commoneventframework";
import { CommonEvent, LambdaEvent } from "commoneventframework/dist/types/commonEvent";
import { HandlerFn, InputParserFn } from "./handlers/types";
import { NotFoundError, toErrorResponse } from "./http/errors";

export const handler = async (
	event: LambdaEvent,
	context: Context
): Promise<APIGatewayProxyStructuredResultV2> => {
	await envReady;
	await setLambdaContext(context);
	const commonEvent: CommonEvent = await buildCommonEvent(event);

	try {
		const routeConfig = getRouteConfig(commonEvent);

		if (!routeConfig || !routeConfig.handler) {
			throw new NotFoundError("Route not found");
		}

		const handlerFn = resolveHandlerRef(routeConfig.handler) as HandlerFn | undefined;
		const parserFn = routeConfig.inputParser
			? resolveHandlerRef(routeConfig.inputParser) as InputParserFn | undefined
			: undefined;

		if (!handlerFn) {
			throw new Error(`Handler "${routeConfig.handler}" not found`);
		}

		const input = parserFn ? parserFn(commonEvent) : {};
		if (input instanceof Response) return input;

		const result = await handlerFn(input, commonEvent);

		if (result && 'statusCode' in result) {
			return result as APIGatewayProxyStructuredResultV2;
		}
		return new Response(200, result as object);
	} catch (err) {
		// Parsers and handlers throw AppErrors (400/401/403/404/409); anything else becomes a 500.
		return toErrorResponse(err);
	}
};

if (process.argv.includes("--local")) {
	startDevServer(handler);
}
