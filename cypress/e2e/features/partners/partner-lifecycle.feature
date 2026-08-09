@e2e @partners @smoke
Feature: Partner management

    Background:
        Given I am logged in to the administration platform
        Then I should be on the "Requests" page
        When I open the "Partners" section
        Then I should be on the "Partners" page

    Scenario: Create a Service Partner
        When I fill the "Partner" form with valid required data
        And I submit the "Partner" form
        Then the "Partner" should be created successfully

    Scenario: Update a Service Partner
        When I fill the "Partner" form with valid required data
        And I submit the "Partner" form
        Then the "Partner" should be created successfully
        When I update the "Partner" form with new details
        And I submit the "Partner" form
        Then the "Partner" changes should be persisted
