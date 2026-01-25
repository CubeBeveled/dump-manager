const { exec } = require("child_process");
const { Command } = require("commander");
const path = require("path");

const { version } = require("./package.json");
const program = new Command();

program
  .name("dump-manager")
  .description("CLI to manage database dumps")
  .version(version);

program
  .command("mysql")
  .description("Manage mysql dumps")
  .argument("<host>", "The database ip/host")
  .argument("[port]", "The database port", 3306)
  .argument("<database>", "The name of the database to dump")
  .argument("<username>", "The username of the database to dump")
  .argument(
    "<password>",
    "The password of the username of the database to dump",
  )
  .argument("<dump folder>", "The folder where the dumps will be stored")
  .argument("[dump file name]", "The name of the dump file")
  .action(
    (host, port, database, username, password, dumpFolder, dumpFileName) => {
      let testCmd;

      if (process.platform === "win32") {
        testCmd = "where mysqldump";
      } else {
        testCmd = "which mysqldump";
      }

      exec(testCmd, (error, stdout, stderr) => {
        if (error || !stdout.trim()) {
          program.error("mysqldump not found");
        } else {
          if (!dumpFileName) {
            const now = new Date();

            const year = now.getFullYear();
            const month = String(now.getMonth() + 1);
            const day = String(now.getDate());
            const hours = String(now.getHours());
            const minutes = String(now.getMinutes());
            const seconds = String(now.getSeconds());

            dumpFileName = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
          }

          if (!dumpFileName.includes(".")) dumpFileName += ".sql";

          let dumpPath = path.join(dumpFolder, dumpFileName);

          exec(
            `mysqldump -h "${host}" -P ${port} --password="${password}" -u "${username}" "${database}" > "${dumpPath}"`,
            (error, stdout, stderr) => {
              if (error) {
                program.error(`Dump error: ${error.message}`);
              }

              console.log("Dump saved to", dumpPath);
            },
          );
        }
      });
    },
  );

program.parse();
