<?php
// ==========================================================
// Tests :: Panel Contracts
// ==========================================================
//
// Exercises the plugin public behavior with disposable Kirby fixtures.
//
// ==========================================================

declare(strict_types=1);

namespace Zeimoto\Panel\Tests;

final class ContractTest extends PluginTestCase
{
  public function testPluginBootsWithoutHostConfiguration(): void
  {
    $app = $this->app();
    self::assertArrayHasKey("zeimoto/panel", $app->plugins());
    self::assertSame("Test site", $app->site()->title()->value());
  }
}
