"""Shared conversion errors; importing this module never reads private archives."""


class MigrationError(Exception):
    """Only controlled, non-sensitive error codes may leave the migration tools."""
