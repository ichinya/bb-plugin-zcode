import importlib.machinery
import importlib.util
from contextlib import closing
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest import mock


BRIDGE = Path(__file__).resolve().parents[1] / "bin" / "zcbridge"
loader = importlib.machinery.SourceFileLoader("zcbridge", str(BRIDGE))
spec = importlib.util.spec_from_loader(loader.name, loader)
bridge = importlib.util.module_from_spec(spec)
loader.exec_module(bridge)


class WindowsPortTests(unittest.TestCase):
    def test_readonly_database_with_special_characters(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "тест #?.sqlite"
            if os.name == "nt":
                database = Path(directory) / "тест #.sqlite"
            with closing(sqlite3.connect(database)) as connection:
                connection.execute("create table example (value text)")
                connection.execute("insert into example values ('ok')")
                connection.commit()
            with closing(bridge.conn(str(database))) as connection:
                self.assertEqual(connection.execute("select value from example").fetchone()[0], "ok")
                with self.assertRaises(sqlite3.OperationalError):
                    connection.execute("insert into example values ('no')")

    def test_lock_times_out_and_can_be_reused(self):
        with tempfile.TemporaryDirectory() as directory:
            lock = str(Path(directory) / "lock")
            with bridge.file_lock(lock):
                with self.assertRaises(bridge.BridgeError) as error:
                    with bridge.file_lock(lock, timeout=0.1):
                        pass
                self.assertEqual(error.exception.code, "busy")
            with bridge.file_lock(lock, timeout=0.1):
                pass

    @unittest.skipUnless(os.name == "nt", "Windows-specific behavior")
    def test_windows_ui_fails_closed(self):
        with self.assertRaises(bridge.BridgeError) as error:
            bridge.zc("press", "AXButton", "Send")
        self.assertEqual(error.exception.code, "unsupported_platform")

    @unittest.skipUnless(os.name == "nt", "Windows-specific behavior")
    def test_windows_read_only_helper_is_invoked_without_shell(self):
        result = mock.Mock(returncode=0, stdout="1\n", stderr="")
        with mock.patch.object(bridge.subprocess, "run", return_value=result) as run:
            self.assertEqual(bridge.zc("count", "AXButton", "Send"), "1\n")
        args, kwargs = run.call_args
        self.assertEqual(args[0][-3:], ["count", "AXButton", "Send"])
        self.assertNotIn("shell", kwargs)
        self.assertEqual(kwargs["encoding"], "utf-8")

    @unittest.skipUnless(os.name == "nt", "Windows-specific behavior")
    def test_windows_helper_errors_fail_closed_even_when_unchecked(self):
        result = mock.Mock(returncode=3, stdout="ERR no-window\n", stderr="")
        with mock.patch.object(bridge.subprocess, "run", return_value=result):
            with self.assertRaises(bridge.BridgeError) as error:
                bridge.zc("count", "AXButton", "Send", check=False)
        self.assertEqual(error.exception.code, "no_window")

    @unittest.skipUnless(os.name == "nt", "Windows-specific behavior")
    def test_pid_check_does_not_terminate_process(self):
        self.assertTrue(bridge.pid_alive(os.getpid()))
        self.assertFalse(bridge.pid_alive(0))


if __name__ == "__main__":
    unittest.main()
