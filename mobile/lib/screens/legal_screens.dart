import 'package:flutter/material.dart';

import '../content/legal.dart';

class LegalTextScreen extends StatelessWidget {
  final String title;
  final List<(String, String)> sections;

  const LegalTextScreen({super.key, required this.title, required this.sections});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Last updated: $legalLastUpdated', style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 16),
          for (final (h, body) in sections) ...[
            Text(h, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(body, style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 20),
          ],
        ],
      ),
    );
  }
}

/// Mirrors web/src/content/legal.ts section titles and bodies.
List<(String, String)> get termsSections => const [
      ('What Find the Game is',
          'Find the Game helps people discover outdoor courts, join pickup games, and get alerts when games start nearby. You must be 13 or older.'),
      ('Your account',
          'Keep your login private. One person per account. Do not impersonate others or harass players or hosts.'),
      ('Courts & games',
          'Locations and schedules come from the community and may be wrong. Playing is at your own risk. Hosts can cancel games.'),
      ('Content you post',
          'You allow us to display photos and text you upload so the app works. No illegal or hateful content.'),
      ('Moderation', 'We may remove content or suspend accounts that break these rules.'),
    ];

List<(String, String)> get privacySections => const [
      ('What we collect',
          'Account info, optional photo, sport preferences, games you join, court proposals, check-ins, coarse location for nearby results and alerts, push tokens if enabled, and security logs.'),
      ('Location',
          'GPS stays on your device except for check-ins and rounded coordinates sent to load nearby courts and games.'),
      ('How we use data', 'To run the map, alerts, and prevent abuse. We do not sell your personal data.'),
      ('Sharing', 'Other players see your public profile on games you join. Hosting and map providers process data to operate the app.'),
    ];
