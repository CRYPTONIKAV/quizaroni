import * as fs from "fs";
import * as path from "path";

// Regression guard for #179: handlers used to log { event, context } (bearer
// token, cookies, raw body), the parsed body, and stored set/user content.
// These scan the source, so a new lambda that copies the old pattern fails
// here even without its own handler test.

const API_ROOT = path.join(__dirname, "../..");
const LAMBDAS_DIR = path.join(API_ROOT, "service/lambdas");
const UTILITIES_DIR = path.join(API_ROOT, "utilities");

const FORBIDDEN_LOGS: Record<string, RegExp> = {
    eventInObject: /console\.\w+\(\s*(JSON\.stringify\(\s*)?\{[^}]*\bevent\b(?!\.)/g,
    eventDirect: /console\.\w+\(\s*(JSON\.stringify\(\s*)?event\b(?!\.)/g,
    bodyInObject: /console\.\w+\(\s*(JSON\.stringify\(\s*)?\{[^}]*\bbody\b(?!\.)/g,
    storedContent:
        /console\.\w+\([^;]*?JSON\.stringify\(\s*(Item\b|delete\w*Response\b|\{\s*updated\w+\s*\})|console\.\w+\(\s*\{\s*ExpressionAttribute/g,
};

// Every deployed handler logs a summary, so a new lambda is covered by
// default. These are the ones that legitimately do not.
const NO_SUMMARY_LAMBDAS = [
    "apiAuthorizer", // logs only the failure name/code; its event is not an HTTP API request
    "logtoUserCreatedWebhook", // Logto sends no Quizaroni token; logs its own rejection reasons
];

const lambdaSource = (name: string) =>
    path.join(LAMBDAS_DIR, name, "src", `${name}.ts`);

const sourceFiles = () => {
    const files: string[] = [];
    for (const dir of fs.readdirSync(LAMBDAS_DIR)) {
        const src = path.join(LAMBDAS_DIR, dir, "src");
        if (!fs.existsSync(src)) continue;
        for (const file of fs.readdirSync(src)) {
            if (file.endsWith(".ts")) files.push(path.join(src, file));
        }
    }
    for (const file of fs.readdirSync(UTILITIES_DIR)) {
        if (file.endsWith(".ts")) files.push(path.join(UTILITIES_DIR, file));
    }
    return files;
};

describe("request logging", () => {
    it("never logs the raw event, the parsed body or stored content", () => {
        const files = sourceFiles();
        expect(files.length).toBeGreaterThanOrEqual(30);

        const offenders: string[] = [];
        for (const file of files) {
            const text = fs.readFileSync(file, "utf8");
            for (const [name, pattern] of Object.entries(FORBIDDEN_LOGS)) {
                for (const match of text.matchAll(pattern)) {
                    const line = text.slice(0, match.index).split("\n").length;
                    offenders.push(`${name} ${path.relative(API_ROOT, file)}:${line}`);
                }
            }
        }

        expect(offenders).toEqual([]);
    });

    it("every handler logs a request summary", () => {
        const handlers = fs
            .readdirSync(LAMBDAS_DIR)
            .filter((name) => fs.existsSync(path.join(LAMBDAS_DIR, name, "index.ts")))
            .filter((name) => !NO_SUMMARY_LAMBDAS.includes(name));
        expect(handlers.length).toBeGreaterThanOrEqual(30);

        const missing = handlers.filter(
            (name) => !fs.readFileSync(lambdaSource(name), "utf8").includes("logRequest(event)")
        );

        expect(missing).toEqual([]);
    });
});
