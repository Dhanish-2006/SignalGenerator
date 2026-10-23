import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

class Main {

    private static final int PORT = 8080;

    private static final Path ROOT =
            Path.of(".").toAbsolutePath().normalize();

    public static void main(String[] args) throws IOException {

        HttpServer server = HttpServer.create(
                new InetSocketAddress("127.0.0.1", PORT),
                0
        );

        server.createContext(
                "/api/measure",
                Main::measure
        );

        server.createContext(
                "/",
                Main::serveFiles
        );

        server.start();

        System.out.println("--------------------------------");
        System.out.println("SignalLab server started");
        System.out.println(
                "Open http://localhost:" + PORT
        );
        System.out.println("--------------------------------");

    }


    /* ====================================
       SIGNAL MEASUREMENTS API
       ==================================== */

    private static void measure(
            HttpExchange exchange
    ) throws IOException {

        if (!exchange.getRequestMethod().equals("GET")) {

            send(
                    exchange,
                    405,
                    "application/json",
                    "{\"error\":\"Method not allowed\"}"
            );

            return;

        }


        Map<String, String> parameters =
                parseQuery(
                        exchange.getRequestURI().getRawQuery()
                );


        try {

            String waveform =
                    parameters.getOrDefault(
                            "waveform",
                            "sine"
                    ).toLowerCase(Locale.ROOT);


            double frequency =
                    Double.parseDouble(
                            parameters.getOrDefault(
                                    "frequency",
                                    "2"
                            )
                    );


            double amplitude =
                    Double.parseDouble(
                            parameters.getOrDefault(
                                    "amplitude",
                                    "5"
                            )
                    );


            if (
                    !Double.isFinite(frequency) ||
                    frequency < 0.5 ||
                    frequency > 10
            ) {

                send(
                        exchange,
                        400,
                        "application/json",
                        "{\"error\":\"Frequency must be between 0.5 and 10 Hz\"}"
                );

                return;

            }


            if (
                    !Double.isFinite(amplitude) ||
                    amplitude < 1 ||
                    amplitude > 10
            ) {

                send(
                        exchange,
                        400,
                        "application/json",
                        "{\"error\":\"Amplitude must be between 1 and 10 V\"}"
                );

                return;

            }


            double rmsFactor;


            switch (waveform) {

                case "sine":

                    rmsFactor =
                            1.0 / Math.sqrt(2.0);

                    break;


                case "square":

                    rmsFactor = 1.0;

                    break;


                case "triangle":
                case "sawtooth":

                    rmsFactor =
                            1.0 / Math.sqrt(3.0);

                    break;


                default:

                    send(
                            exchange,
                            400,
                            "application/json",
                            "{\"error\":\"Unsupported waveform\"}"
                    );

                    return;

            }


            double peakVoltage =
                    amplitude;

            double peakToPeak =
                    2.0 * amplitude;

            double rmsVoltage =
                    amplitude * rmsFactor;

            double periodMs =
                    1000.0 / frequency;

            double angularFrequency =
                    2.0 * Math.PI * frequency;


            String json = String.format(
                    Locale.US,

                    "{"
                            + "\"waveform\":\"%s\","
                            + "\"peakVoltage\":%.4f,"
                            + "\"peakToPeak\":%.4f,"
                            + "\"rmsVoltage\":%.4f,"
                            + "\"frequency\":%.4f,"
                            + "\"periodMs\":%.4f,"
                            + "\"angularFrequency\":%.4f"
                            + "}",

                    waveform,
                    peakVoltage,
                    peakToPeak,
                    rmsVoltage,
                    frequency,
                    periodMs,
                    angularFrequency
            );


            send(
                    exchange,
                    200,
                    "application/json",
                    json
            );


        } catch (NumberFormatException exception) {

            send(
                    exchange,
                    400,
                    "application/json",
                    "{\"error\":\"Invalid numeric parameter\"}"
            );

        }

    }


    /* ====================================
       QUERY STRING PARSER
       ==================================== */

    private static Map<String, String> parseQuery(
            String query
    ) {

        Map<String, String> parameters =
                new HashMap<>();

        if (query == null || query.isEmpty()) {

            return parameters;

        }


        for (String item : query.split("&")) {

            String[] pair =
                    item.split("=", 2);


            if (pair.length != 2) {

                continue;

            }


            String key = URLDecoder.decode(
                    pair[0],
                    StandardCharsets.UTF_8
            );


            String value = URLDecoder.decode(
                    pair[1],
                    StandardCharsets.UTF_8
            );


            parameters.put(key, value);

        }


        return parameters;

    }


    /* ====================================
       SERVE WEBSITE FILES
       ==================================== */

    private static void serveFiles(
            HttpExchange exchange
    ) throws IOException {

        if (!exchange.getRequestMethod().equals("GET")) {

            send(
                    exchange,
                    405,
                    "text/plain",
                    "Method not allowed"
            );

            return;

        }


        String requestedPath =
                exchange.getRequestURI().getPath();


        if (requestedPath.equals("/")) {

            requestedPath = "/index.html";

        }


        Path file = ROOT.resolve(
                "." + requestedPath
        ).normalize();


        if (
                !file.startsWith(ROOT) ||
                !Files.isRegularFile(file)
        ) {

            send(
                    exchange,
                    404,
                    "text/plain",
                    "File not found"
            );

            return;

        }


        String fileName =
                file.getFileName().toString();


        String contentType;


        if (fileName.endsWith(".html")) {

            contentType =
                    "text/html; charset=UTF-8";

        } else if (fileName.endsWith(".css")) {

            contentType =
                    "text/css; charset=UTF-8";

        } else if (fileName.endsWith(".js")) {

            contentType =
                    "text/javascript; charset=UTF-8";

        } else {

            contentType =
                    "application/octet-stream";

        }


        byte[] content =
                Files.readAllBytes(file);


        exchange.getResponseHeaders().set(
                "Content-Type",
                contentType
        );


        exchange.getResponseHeaders().set(
                "Cache-Control",
                "no-store"
        );


        exchange.getResponseHeaders().set(
                "X-Content-Type-Options",
                "nosniff"
        );


        exchange.getResponseHeaders().set(
                "X-Frame-Options",
                "DENY"
        );


        exchange.getResponseHeaders().set(
                "Content-Security-Policy",
                "default-src 'self'; "
                        + "script-src 'self'; "
                        + "style-src 'self'; "
                        + "connect-src 'self'; "
                        + "img-src 'self' data:; "
                        + "object-src 'none'; "
                        + "base-uri 'self'"
        );


        exchange.sendResponseHeaders(
                200,
                content.length
        );


        try (
                OutputStream output =
                        exchange.getResponseBody()
        ) {

            output.write(content);

        }

    }


    /* ====================================
       HTTP RESPONSE HELPER
       ==================================== */

    private static void send(
            HttpExchange exchange,
            int status,
            String contentType,
            String response
    ) throws IOException {

        byte[] bytes =
                response.getBytes(
                        StandardCharsets.UTF_8
                );


        exchange.getResponseHeaders().set(
                "Content-Type",
                contentType + "; charset=UTF-8"
        );


        exchange.getResponseHeaders().set(
                "X-Content-Type-Options",
                "nosniff"
        );


        exchange.sendResponseHeaders(
                status,
                bytes.length
        );


        try (
                OutputStream output =
                        exchange.getResponseBody()
        ) {

            output.write(bytes);

        }

    }

}